// Pruebas de humo contra staging. Uso:  node kit.js smoke
// Comprueba salud y, si existe, ejecuta SMOKE_CMD del proyecto. Sin SMOKE_CMD, solo se prueba salud
// y se AVISA: el release-manager debe pedir al proyecto un SMOKE_CMD real, no improvisar pruebas manuales.
"use strict";
const C = require("./common");

module.exports = async function smoke() {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  let fallos = 0;
  if (cfg.STAGING_PROVIDER === "ninguno") { C.log.warn("STAGING_PROVIDER = ninguno: no hay smoke automatizable."); return 3; }

  C.log.step(`Smoke: salud en ${cfg.STAGING_URL}${cfg.HEALTH_PATH}`);
  if (cfg.HEALTH_PATH) {
    const code = await C.httpStatus(`${cfg.STAGING_URL}${cfg.HEALTH_PATH}`, 8000);
    if (code === 200) C.log.ok(`${cfg.HEALTH_PATH} -> 200`);
    else { C.log.fail(`${cfg.HEALTH_PATH} -> ${code || "sin respuesta"} (esperado 200)`); fallos++; }
  }
  if (cfg.STAGING_PROVIDER === "docker") {
    C.log.step("Contenedor sin reinicios");
    const r = C.run(`docker inspect --format {{.RestartCount}} ${cfg.APP_NAME}-staging`, { ignoreFailure: true, quiet: true });
    const restarts = parseInt((r.out || "").trim(), 10);
    if (r.code === 0 && restarts > 0) { C.log.fail(`El contenedor se reinició ${restarts} veces`); fallos++; } else C.log.ok("0 reinicios");
  }
  if (!cfg.SMOKE_CMD || !String(cfg.SMOKE_CMD).trim()) {
    C.log.warn("SMOKE_CMD vacío: solo se probó la salud. Define en pipeline.config.json un comando de smoke del proyecto (p. ej. un script que llame a los endpoints de la feature).");
  } else {
    C.log.step(`Smoke del proyecto: ${cfg.SMOKE_CMD}`);
    const r = C.run(cfg.SMOKE_CMD, { cwd: root, ignoreFailure: true, env: { STAGING_URL: cfg.STAGING_URL } });
    if (r.code !== 0) { C.log.fail(`SMOKE_CMD terminó con código ${r.code}`); fallos++; } else C.log.ok("SMOKE_CMD");
  }
  if (fallos === 0) { C.log.green("\nSMOKE TESTS: PASARON"); C.setState(root, { smoke_ok: true }); return 0; }
  C.log.red(`\nSMOKE TESTS: ${fallos} FALLO(S)`); C.setState(root, { smoke_ok: false }); return 1;
};
