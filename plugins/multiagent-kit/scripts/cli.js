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
    case "doctor": return require("./doctor")(opts);
    case "lecciones": {
      const R = require("./remote"), fs = require("fs");
      const p = R.ensureLessons();
      if (opts._[0] === "add" || opts._[0] === "agregar") {
        const txt = opts._.slice(1).join(" ").trim();
        if (!txt) { console.error("Uso: node kit.js lecciones add \"[stack] lección\""); return 1; }
        fs.appendFileSync(p, `- [${new Date().toISOString().slice(0, 10)}] ${txt}\n`, "utf8");
        C.log.ok(`Añadida a ${p}`);
        return 0;
      }
      console.log(`${p}\n`); console.log(fs.readFileSync(p, "utf8")); return 0;
    }
    case "version": {
      const root = C.findProjectRoot();
      const m = root ? (C.readJson(path.join(root, ".github", "kit-manifest.json"), null) || C.readJson(path.join(root, ".pipeline", "kit-manifest.json"), null)) : null;
      console.log(`Plugin (${C.FLAVOR}): ${C.VERSION}  ·  Archivos del proyecto: ${m ? m.version + " (modo " + (m.mode || "repo") + ")" : "(sin inicializar)"}  ·  ${C.PLUGIN_ROOT}`);
      if (m && m.version !== C.VERSION) C.log.yellow("Ejecuta node kit.js update para refrescar los archivos gestionados.");
      return 0;
    }
    default:
      console.error(`Comando desconocido: ${cmd}. Usa: check | staging | smoke | prod | status | state | init | update | migrate | sdk | doctor | lecciones | version`);
      return 1;
  }
}
if (require.main === module) main(process.argv[2] || "help", process.argv.slice(3)).then((c) => process.exit(c || 0), (e) => { console.error(e.message); process.exit(1); });
module.exports = { main };
