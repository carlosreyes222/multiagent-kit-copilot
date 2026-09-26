// Estado del pipeline con esquema fijo. Único punto de escritura de .pipeline/state.json (con lock y escritura atómica:
// varios agentes pueden escribir a la vez).
//   kit status                          -> muestra el estado
//   kit state stage=qa qa=APROBADO      -> actualiza claves (ver esquema abajo); valores fuera del esquema se rechazan
// Esquema (schema_version 2). Claves permitidas y valores esperados:
//   feature (slug) · type (feature|bugfix) · mode (nuevo|existente) · stage (spec|arquitectura|implementacion|qa|revisiones|pr|documentacion|entrega|reproducir|corregir)
//   qa / codigo / seguridad (PENDIENTE|APROBADO|RECHAZADO) · qa_iter / codigo_iter (entero) · started_at
//   sdk (nombre del SDK en flujo end-to-end, ver SDKS) · sdk_version (versión de trabajo enlazada en el padre)
//   ticket (Jira, p. ej. BMOSHELL-123: ramas feature/BMOSHELL-123-desc y commits "feat: BMOSHELL-123 …"; lo exige el hook)
//   pr_base / pr_estado (creado|rama_subida|rama_local) / pr_url  — kit de Copilot: entrega por pull request
//   epica (nombre de docs/epicas/<nombre>.md cuando la HU forma parte de una idea partida en varias)
//   tamano (S|M|L, lo estima el product-owner) · compuertas (completas|reducidas: modo --rapido o --urgente, queda registrado)
//   staging_ok / smoke_ok / staging_at / promoted_at / promoted_tag — solo kit de Claude (staging y producción)
//   kit state reset [--sin-archivar]    -> cierra la feature y empieza de cero (histórico en .pipeline/historial.jsonl).
//                                          y archiva spec, ADR e informes en ~/.multiagent-kit/archivo/<proyecto>/<slug>/
//   kit state archivar <slug>           -> archiva a mano los documentos de una feature ya cerrada
//   kit state restaurar <slug>          -> los devuelve al proyecto (el PR pidió cambios después de cerrarla)
"use strict";
const path = require("path");
const C = require("./common");

module.exports = async function state(opts, { show }) {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  const sets = opts._;
  if (sets[0] === "reset") {
    const prev = C.resetState(root);
    if (prev.feature) C.log.plain(`Estado anterior (${prev.feature}) archivado en .pipeline/historial.jsonl`);
    if (prev.feature && !opts["sin-archivar"]) archive(root, prev.feature, prev);
    C.log.ok("Estado reiniciado.");
    return 0;
  }
  if (sets[0] === "archivar") {
    // Archiva a mano una feature ya cerrada (p. ej. HU terminadas antes de que existiera el archivo): kit state archivar <slug>
    const slug = sets[1];
    const bad = slug ? C.stateValueError("feature", slug) : "falta el slug";
    if (bad) { C.log.fail(`Uso: kit state archivar <slug> (${bad})`); return 1; }
    if (C.getState(root).feature === slug) { C.log.fail(`${slug} es la feature en curso: ciérrala con kit state reset`); return 1; }
    return archive(root, slug, { feature: slug }, true) ? 0 : 1;
  }
  if (sets[0] === "restaurar") {
    // Reabre una feature archivada (el PR o staging piden cambios): devuelve spec, ADR e informes al proyecto
    const slug = sets[1];
    const bad = slug ? C.stateValueError("feature", slug) : "falta el slug";
    if (bad) { C.log.fail(`Uso: kit state restaurar <slug> (${bad})`); return 1; }
    const r = C.restoreFeatureDocs(root, slug);
    if (!r) { C.log.fail(`${slug} no está en el archivo (${C.archiveRoot(root)})`); return 1; }
    C.log.ok(`${slug}: ${r.restaurados.length} documento(s) devueltos al proyecto`);
    r.restaurados.forEach((f) => C.log.plain("  <- " + f));
    r.conservados.forEach((f) => C.log.warn(`  ${f} ya existía en el proyecto: se conserva el del proyecto`));
    return 0;
  }
  if (sets.length) {
    const changes = {};
    for (const kv of sets) {
      const m = /^([a-z_]+)=(.*)$/.exec(kv);
      if (!m) { C.log.fail(`Formato inválido: '${kv}' (usa clave=valor)`); return 1; }
      const k = m[1]; let v = m[2];
      if (!C.STATE_KEYS.includes(k)) { C.log.fail(`Clave no permitida: ${k}. Permitidas: ${C.STATE_KEYS.join(", ")}`); return 1; }
      if (v === "true" || v === "false") v = v === "true";
      else if (/^\d+$/.test(v)) v = parseInt(v, 10);
      if (["qa", "codigo", "seguridad", "tamano"].includes(k) && typeof v === "string") v = v.toUpperCase();
      if (k === "ticket" && typeof v === "string") v = v.toUpperCase();
      const err = C.stateValueError(k, v);
      if (err) { C.log.fail(`Valor no válido para ${k}: '${m[2]}' (${err})`); return 1; }
      changes[k] = v;
    }
    const s = C.getState(root);
    if (!s.started_at) changes.started_at = C.nowIso();
    C.setState(root, changes);
    C.log.ok(`Estado actualizado: ${Object.keys(changes).join(", ")}`);
  }
  if (show || !sets.length) {
    const s = C.getState(root);
    C.log.step("Estado del pipeline");
    for (const [k, v] of Object.entries(s)) console.log(`  ${k.padEnd(15)} : ${v}`);
    if (C.FLAVOR === "copilot") {
      const rep = (k) => path.join(root, "docs", "reviews", `${s.feature}-${k}.md`);
      C.log.cyan("\nCompuertas para el PR (según los informes en disco):");
      if (s.feature) console.log(`  qa = ${C.reportVerdict(rep("qa"), "QA")}   codigo = ${s.compuertas === "reducidas" ? "(omitida: modo rápido)" : C.reportVerdict(rep("codigo"), "C[OÓ]DIGO")}   seguridad = ${C.securityVerdict(root, s.feature)}`);
      else console.log("  (sin feature en curso)");
    } else {
      C.log.cyan("\nCompuertas para producción:");
      console.log(`  staging_ok = ${s.staging_ok}   smoke_ok = ${s.smoke_ok}   seguridad = ${C.securityVerdict(root, s.feature)}`);
    }
    const over = C.docLimits(root, cfg);
    if (over.length) { C.log.warn("Documentos por encima del límite:"); over.forEach((o) => C.log.warn("  " + o)); }
    const E = require("./epica");
    const names = s.epica && E.load(root, s.epica) ? [s.epica] : E.listNames(root);
    for (const n of names) { try { E.status(root, n); } catch { /* épica mal formada */ } }
  }
  return 0;
};

// Mueve los documentos de trabajo de la feature al archivo del perfil y, si su épica quedó completa, también la épica.
function archive(root, slug, prev, explicit) {
  const r = C.archiveFeatureDocs(root, slug, { meta: { ticket: prev.ticket || "", epica: prev.epica || "", pr_url: prev.pr_url || "", pr_estado: prev.pr_estado || "", staging_ok: !!prev.staging_ok, promoted_tag: prev.promoted_tag || "" } });
  const n = r.movidos.length + r.copiados.length + r.noBorrados.length;
  if (!n) { (explicit ? C.log.warn : C.log.plain)(`${slug}: no hay documentos de trabajo que archivar`); return false; }
  C.log.ok(`Documentos de ${slug} archivados en ${r.dir}`);
  r.movidos.forEach((f) => C.log.plain("  -> " + f));
  r.copiados.forEach((f) => C.log.warn(`  ${f} está versionado en git: copiado, no movido (sácalo del repo con git rm --cached si ya no debe estar)`));
  r.noBorrados.forEach((f) => C.log.warn(`  ${f} copiado pero no se pudo quitar del proyecto (¿abierto en el editor?)`));
  if (prev.epica) {
    try {
      const dst = require("./epica").archiveIfComplete(root, prev.epica);
      if (dst) C.log.ok(`Épica ${prev.epica} completa: archivada en ${dst}`);
    } catch { /* épica mal formada: se queda donde está */ }
  }
  return true;
}
