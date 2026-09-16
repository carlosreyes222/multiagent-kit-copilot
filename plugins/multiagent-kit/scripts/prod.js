// Promueve a PRODUCCIÓN. Última compuerta del pipeline. Exige:
//   1) staging desplegado y smoke tests pasados (.pipeline/state.json)
//   2) VEREDICTO: APROBADO del revisor de seguridad (docs/reviews/<feature>-seguridad.md)
//   3) confirmación humana escrita (o --yes desde una persona en CI)
// Uso:  node kit.js prod   |   node kit.js prod --yes
"use strict";
const readline = require("readline");
const C = require("./common");

function ask(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); resolve((a || "").trim()); });
  });
}

module.exports = async function prod(opts) {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  const s = C.getState(root);
  C.log.step(`Verificando compuertas para la feature '${s.feature}'`);
  const bloqueos = [];
  if (!s.feature) bloqueos.push("No hay feature en .pipeline/state.json (corre node kit.js staging --feature <slug>).");
  if (!s.staging_ok) bloqueos.push("Staging no está desplegado correctamente (corre node kit.js staging).");
  if (!s.smoke_ok) bloqueos.push("Smoke tests no han pasado (corre node kit.js smoke).");
  const veredicto = C.securityVerdict(root, s.feature);
  if (veredicto !== "APROBADO") bloqueos.push(`Revisión de seguridad: ${veredicto} (se requiere APROBADO en docs/reviews/${s.feature}-seguridad.md).`);
  if (bloqueos.length) { bloqueos.forEach(C.log.fail); C.log.red("\nPROMOCIÓN BLOQUEADA."); return 2; }
  C.log.ok("Staging OK, smoke OK, seguridad APROBADO");

  const over = C.docLimits(root, cfg);
  if (over.length) { C.log.warn("Documentos por encima del límite (no bloquea, pero pide al arquitecto que los resuma):"); over.forEach((o) => C.log.warn("  " + o)); }

  if (!opts.yes) {
    const resp = await ask(`\nEscribe PRODUCCION para confirmar el despliegue de '${s.feature}': `);
    if (resp !== "PRODUCCION") { C.log.warn("Cancelado por el usuario."); return 1; }
  }
  if (cfg.PROD_DEPLOY_CMD && String(cfg.PROD_DEPLOY_CMD).trim()) {
    C.runProjectCmd(root, "Despliegue a producción", cfg.PROD_DEPLOY_CMD);
  } else if (cfg.STAGING_PROVIDER === "supabase") {
    if (!cfg.SUPABASE_PROD_REF) { C.log.fail("SUPABASE_PROD_REF vacío."); return 1; }
    if (!C.supabaseDeploy(root, cfg, cfg.SUPABASE_PROD_REF, "PRODUCCIÓN")) { C.log.fail("Falló el despliegue a Supabase producción."); return 1; }
  } else {
    C.log.warn("PROD_DEPLOY_CMD vacío: simulando despliegue (dry-run).");
  }
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const tag = `prod-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}-${s.feature}`;
  C.run(`git tag ${tag}`, { cwd: root, ignoreFailure: true, quiet: true });
  C.log.ok(`Etiqueta creada: ${tag}`);
  C.setState(root, { promoted_at: C.nowIso(), promoted_tag: tag });
  C.log.green("\nPRODUCCIÓN ACTUALIZADA.");
  return 0;
};
