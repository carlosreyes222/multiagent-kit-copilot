// Enrutador de comandos del kit. Lo invoca kit.js del proyecto (o directamente: node scripts/cli.js <comando>).
"use strict";
const path = require("path");
const C = require("./common");

async function main(cmd, argv) {
  const opts = C.parseArgs(argv);
  switch (cmd) {
    case "check": return require("./check")(opts);
    case "staging": case "smoke": case "prod":
      if (C.FLAVOR !== "claude") { console.error(`'${cmd}' no existe en el kit de Copilot: el flujo termina en el PR (kit pr).`); return 1; }
      return require("./" + cmd)(opts);
    case "pr":
      if (C.FLAVOR !== "copilot") { console.error("'pr' es del kit de Copilot; en Claude el flujo sigue con staging y prod."); return 1; }
      return require("./pr")(opts);
    case "status": return require("./state")(opts, { show: true });
    case "state": return require("./state")(opts, { show: false });
    case "init": return require("./init")(opts, { mode: "init" });
    case "update": return require("./init")(opts, { mode: "update" });
    case "migrate": return require("./init")(opts, { mode: "migrate" });
    case "sdk": return require("./sdk")(opts);
    case "doctor": return require("./doctor")(opts);
    case "epica": return require("./epica")(opts);
    case "plantilla": {
      const root = C.findProjectRoot();
      const kinds = opts._[0] ? [opts._[0]] : Object.keys(C.TEMPLATES);
      for (const k of kinds) { const p = C.templatePath(root, k); if (!p) { console.error(`Plantilla desconocida: ${k} (${Object.keys(C.TEMPLATES).join(", ")})`); return 1; } console.log(kinds.length > 1 ? `${k.padEnd(13)} ${p}` : p); }
      return 0;
    }
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
    case "archivo": {
      // Documentos de features cerradas de este proyecto (kit de Copilot): kit archivo [slug]
      if (C.FLAVOR !== "copilot") { console.error("'archivo' es del kit de Copilot."); return 1; }
      const fs = require("fs");
      const root = C.requireProjectRoot();
      const base = C.archiveRoot(root);
      const slug = opts._[0];
      if (slug) {
        const d = C.archiveDir(root, slug);
        if (!C.isArchived(root, slug)) { console.error(`${slug} no está archivada (${base})`); return 1; }
        const walk = (dir) => fs.readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
        console.log(d); walk(d).forEach((f) => console.log("  " + path.relative(d, f).replace(/\\/g, "/")));
        return 0;
      }
      const list = fs.existsSync(base) ? fs.readdirSync(base).filter((f) => C.isArchived(root, f)) : [];
      console.log(base);
      if (!list.length) { C.log.plain("(vacío: las features se archivan al cerrarlas con kit state reset)"); return 0; }
      list.map((f) => C.readJson(path.join(C.archiveDir(root, f), "archivo.json"), { feature: f }))
        .sort((a, b) => String(b.archivado_at).localeCompare(String(a.archivado_at)))
        .forEach((a) => console.log(`  ${String(a.archivado_at || "").slice(0, 10)}  ${a.feature.padEnd(40)} ${a.pr_url || a.pr_estado || ""}`));
      return 0;
    }
    case "version": {
      const root = C.findProjectRoot();
      const m = root ? (C.readJson(path.join(root, ".github", "kit-manifest.json"), null) || C.readJson(path.join(root, ".pipeline", "kit-manifest.json"), null)) : null;
      console.log(`Plugin (${C.FLAVOR}): ${C.VERSION}  ·  Archivos del proyecto: ${m ? m.version + " (modo " + (m.mode || "repo") + ")" : "(sin inicializar)"}  ·  ${C.PLUGIN_ROOT}`);
      if (m && m.version !== C.VERSION) C.log.yellow("Ejecuta node kit.js update para refrescar los archivos gestionados.");
      return 0;
    }
    default:
      console.error(`Comando desconocido: ${cmd}. Usa: check | ${C.FLAVOR === "claude" ? "staging | smoke | prod" : "pr"} | status | state | init | update | migrate | sdk | epica | plantilla | doctor | lecciones${C.FLAVOR === "copilot" ? " | archivo" : ""} | version`);
      return 1;
  }
}
if (require.main === module) main(process.argv[2] || "help", process.argv.slice(3)).then((c) => process.exit(c || 0), (e) => { console.error(e.message); process.exit(1); });
module.exports = { main };
