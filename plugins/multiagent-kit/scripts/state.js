// Estado del pipeline con esquema fijo. Único punto de escritura de .pipeline/state.json.
//   node kit.js status                          -> muestra el estado
//   node kit.js state stage=qa qa=APROBADO      -> actualiza claves (ver esquema abajo)
// Esquema (schema_version 2). Claves permitidas y valores esperados:
//   feature (slug) · type (feature|bugfix) · mode (nuevo|existente) · stage (spec|arquitectura|implementacion|qa|revisiones|staging|documentacion|entrega|reproducir|corregir)
//   qa / codigo / seguridad (PENDIENTE|APROBADO|RECHAZADO) · qa_iter / codigo_iter (entero)
//   staging_ok / smoke_ok (true|false) · staging_at · promoted_at · promoted_tag · started_at
//   sdk (nombre del SDK en flujo end-to-end, ver SDKS) · sdk_version (versión de trabajo enlazada en el padre)
"use strict";
const C = require("./common");

module.exports = async function state(opts, { show }) {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  const sets = opts._;
  if (sets.length) {
    const changes = {};
    for (const kv of sets) {
      const m = /^([a-z_]+)=(.*)$/.exec(kv);
      if (!m) { C.log.fail(`Formato inválido: '${kv}' (usa clave=valor)`); return 1; }
      const k = m[1]; let v = m[2];
      if (!C.STATE_KEYS.includes(k)) { C.log.fail(`Clave no permitida: ${k}. Permitidas: ${C.STATE_KEYS.join(", ")}`); return 1; }
      if (v === "true" || v === "false") v = v === "true";
      else if (/^\d+$/.test(v)) v = parseInt(v, 10);
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
    C.log.cyan("\nCompuertas para producción:");
    console.log(`  staging_ok = ${s.staging_ok}   smoke_ok = ${s.smoke_ok}   seguridad = ${C.securityVerdict(root, s.feature)}`);
    const over = C.docLimits(root, cfg);
    if (over.length) { C.log.warn("Documentos por encima del límite:"); over.forEach((o) => C.log.warn("  " + o)); }
  }
  return 0;
};
