// Enrutador de comandos del kit. Lo invoca kit.js del proyecto (o directamente: node scripts/cli.js <comando>).
"use strict";
const path = require("path");
const C = require("./common");

async function main(cmd, argv) {
  const opts = C.parseArgs(argv);
  switch (cmd) {
    case "check": return require("./check")(opts);
    case "staging": return require("./staging")(opts);
    case "smoke": return require("./smoke")(opts);
    case "prod": return require("./prod")(opts);
    case "status": return require("./state")(opts, { show: true });
    case "state": return require("./state")(opts, { show: false });
    case "init": return require("./init")(opts, { mode: "init" });
    case "update": return require("./init")(opts, { mode: "update" });
    case "migrate": return require("./init")(opts, { mode: "migrate" });
    case "sdk": return require("./sdk")(opts);
    case "version": {
      const root = C.findProjectRoot();
      const m = root ? (C.readJson(path.join(root, ".github", "kit-manifest.json"), null) || C.readJson(path.join(root, ".pipeline", "kit-manifest.json"), null)) : null;
      console.log(`Plugin (${C.FLAVOR}): ${C.VERSION}  ·  Archivos del proyecto: ${m ? m.version + " (modo " + (m.mode || "repo") + ")" : "(sin inicializar)"}  ·  ${C.PLUGIN_ROOT}`);
      if (m && m.version !== C.VERSION) C.log.yellow("Ejecuta node kit.js update para refrescar los archivos gestionados.");
      return 0;
    }
    default:
      console.error(`Comando desconocido: ${cmd}. Usa: check | staging | smoke | prod | status | state | init | update | migrate | sdk | version`);
      return 1;
  }
}
if (require.main === module) main(process.argv[2] || "help", process.argv.slice(3)).then((c) => process.exit(c || 0), (e) => { console.error(e.message); process.exit(1); });
module.exports = { main };
