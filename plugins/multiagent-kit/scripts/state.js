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
//   kit state reset                     -> empieza de cero (conserva un histórico en .pipeline/historial.jsonl)
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
    C.log.ok("Estado reiniciado.");
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
