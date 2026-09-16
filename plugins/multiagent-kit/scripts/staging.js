// Despliega a STAGING según STAGING_PROVIDER de pipeline.config.json.
// Uso:  node kit.js staging [--feature slug]
"use strict";
const fs = require("fs");
const path = require("path");
const net = require("net");
const C = require("./common");

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

module.exports = async function staging(opts) {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  let feature = opts.feature || "";
  if (!feature) feature = C.currentBranch(root).replace(/^(feature|fix)\//, "");
  const provider = cfg.STAGING_PROVIDER || "docker";
  C.log.step(`Desplegando a STAGING la feature '${feature}' (proveedor: ${provider})`);
  C.setState(root, { feature, staging_ok: false, smoke_ok: false, stage: "staging" });

  if (provider !== "ninguno") {
    C.runProjectCmd(root, "Instalar dependencias", cfg.INSTALL_CMD);
    C.runProjectCmd(root, "Lint", cfg.LINT_CMD);
    C.runProjectCmd(root, "Build", cfg.BUILD_CMD);
    C.runProjectCmd(root, "Tests", cfg.TEST_CMD);
  }
  const assertEnvFile = () => {
    if (cfg.STAGING_ENV_FILE && !fs.existsSync(path.join(root, cfg.STAGING_ENV_FILE)))
      throw new Error(`Falta ${cfg.STAGING_ENV_FILE}. Créalo (sin secretos de producción) antes de desplegar.`);
  };
  const health = `${cfg.STAGING_URL}${cfg.HEALTH_PATH}`;
  let ok = false;

  switch (provider) {
    case "docker": {
      assertEnvFile();
      if (!(await portFree(cfg.STAGING_PORT))) throw new Error(`El puerto ${cfg.STAGING_PORT} ya está en uso en esta máquina. Cambia STAGING_PORT en pipeline.config.json.`);
      const env = { APP_NAME: cfg.APP_NAME, STAGING_PORT: String(cfg.STAGING_PORT), BASE_IMAGE: cfg.BASE_IMAGE, CONTAINER_CMD: cfg.CONTAINER_CMD };
      const envf = path.join(root, cfg.STAGING_ENV_FILE);
      const cwd = path.join(root, "staging");
      C.log.step("docker compose up (staging/docker-compose.staging.yml)");
      C.run(`docker compose --env-file "${envf}" -f docker-compose.staging.yml down --remove-orphans`, { cwd, env, ignoreFailure: true });
      C.run(`docker compose --env-file "${envf}" -f docker-compose.staging.yml up -d --build`, { cwd, env });
      ok = await C.waitHealthy(health);
      if (!ok) C.log.warn("Logs: docker compose -f staging/docker-compose.staging.yml logs --tail 100");
      break;
    }
    case "compose": {
      assertEnvFile();
      const cf = path.join(root, cfg.STAGING_COMPOSE_FILE);
      if (!fs.existsSync(cf)) throw new Error(`No existe ${cfg.STAGING_COMPOSE_FILE}`);
      const envf = path.join(root, cfg.STAGING_ENV_FILE);
      C.log.step(`docker compose up (${cfg.STAGING_COMPOSE_FILE})`);
      C.run(`docker compose --env-file "${envf}" -f "${cf}" down --remove-orphans`, { cwd: root, ignoreFailure: true });
      C.run(`docker compose --env-file "${envf}" -f "${cf}" up -d --build`, { cwd: root });
      ok = await C.waitHealthy(health);
      if (!ok) C.log.warn(`Logs: docker compose -f ${cfg.STAGING_COMPOSE_FILE} logs --tail 100`);
      break;
    }
    case "supabase": {
      if (!cfg.SUPABASE_STAGING_REF) throw new Error("SUPABASE_STAGING_REF vacío. Crea un proyecto Supabase de staging y pon su ref en pipeline.config.json (ver docs/10-supabase.md).");
      if (cfg.SUPABASE_STAGING_REF === cfg.SUPABASE_PROD_REF) throw new Error("SUPABASE_STAGING_REF es igual a SUPABASE_PROD_REF: staging nunca apunta a producción.");
      ok = C.supabaseDeploy(root, cfg, cfg.SUPABASE_STAGING_REF, "STAGING");
      if (ok && cfg.STAGING_URL && cfg.HEALTH_PATH) ok = await C.waitHealthy(health, 30);
      break;
    }
    case "comando": {
      if (!cfg.STAGING_DEPLOY_CMD) throw new Error("STAGING_DEPLOY_CMD vacío para el proveedor 'comando'.");
      C.runProjectCmd(root, "Despliegue a staging", cfg.STAGING_DEPLOY_CMD);
      ok = cfg.STAGING_URL && cfg.HEALTH_PATH ? await C.waitHealthy(health) : true;
      break;
    }
    case "ninguno": {
      C.log.warn("STAGING_PROVIDER = ninguno: no hay staging automatizable. El release-manager debe documentar la verificación manual en el informe de release.");
      C.setState(root, { staging_at: C.nowIso() });
      return 3;
    }
    default:
      throw new Error(`STAGING_PROVIDER desconocido: ${provider} (docker|compose|supabase|comando|ninguno)`);
  }

  if (ok) {
    C.log.ok(`Staging listo en ${cfg.STAGING_URL}`);
    C.setState(root, { staging_ok: true, staging_at: C.nowIso() });
    return 0;
  }
  C.log.fail(`Staging no respondió 200 en ${health}`);
  C.setState(root, { staging_ok: false, staging_at: C.nowIso() });
  return 1;
};
