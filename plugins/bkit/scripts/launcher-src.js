// Código fuente de los lanzadores que se instalan fuera del plugin (comando global `kit` y lanzador de hooks de usuario).
// Ambos necesitan localizar el plugin instalado sin depender de él, así que el resolvedor se genera como texto.
//
// Con los dos kits instalados (Claude Code "multiagent-kit" y Copilot "bkit", antes también "multiagent-kit"); elegir "el más reciente"
// mezclaba los sabores. Orden de resolución:
//   1. KIT_PLUGIN_ROOT (si es un plugin del sabor buscado)
//   2. pluginRoot de .pipeline/kit.json del proyecto (desde el cwd hacia arriba), si es del sabor buscado
//   3. la ruta del plugin que generó el lanzador (PREFERIDO), si sigue existiendo y es del sabor buscado
//   4. el plugin del sabor buscado con la versión más alta en sus carpetas de instalación
// Sabor buscado: el fijo del lanzador (hooks de Copilot: "copilot") o, en el comando global, el del proyecto
// (AGENTS.md → copilot, CLAUDE.md → claude; si hay los dos o ninguno, el del plugin que instaló el lanzador).
"use strict";

function resolverSource({ preferred, flavor, fixedFlavor }) {
  return `const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
const PREFERIDO = ${JSON.stringify(preferred)};
const SABOR_PROPIO = ${JSON.stringify(flavor)};
const SABOR_FIJO = ${JSON.stringify(fixedFlavor || null)};
function manifest(d) {
  if (!d || !fs.existsSync(path.join(d, "scripts", "common.js"))) return null;
  for (const [rel, sabor] of [["plugin.json", "copilot"], [".claude-plugin/plugin.json", "claude"]]) {
    const m = path.join(d, rel);
    if (fs.existsSync(m)) { try { const j = JSON.parse(fs.readFileSync(m, "utf8")); return ["multiagent-kit", "bkit"].includes(j.name) ? { sabor, version: String(j.version || "0") } : null; } catch { return null; } }
  }
  return null;
}
function* walk(dir, depth) {
  if (depth < 0 || !dir || !fs.existsSync(dir)) return;
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of es) { if (!e.isDirectory()) continue; const p = path.join(dir, e.name); if (manifest(p)) yield p; else yield* walk(p, depth - 1); }
}
function cmpVer(a, b) { const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0), pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0); for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; } return 0; }
function proyecto() {
  let d = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(d, "pipeline.config.json")) || fs.existsSync(path.join(d, ".pipeline", "kit.json"))) return d;
    const p = path.dirname(d); if (p === d) return null; d = p;
  }
}
function saborBuscado(dir) {
  if (SABOR_FIJO) return SABOR_FIJO;
  if (dir) { const a = fs.existsSync(path.join(dir, "AGENTS.md")), c = fs.existsSync(path.join(dir, "CLAUDE.md")); if (a && !c) return "copilot"; if (c && !a) return "claude"; }
  return SABOR_PROPIO;
}
function findPlugin() {
  const dir = proyecto(), sabor = saborBuscado(dir);
  const ok = (d) => { const m = manifest(d); return m && m.sabor === sabor; };
  if (ok(process.env.KIT_PLUGIN_ROOT)) return process.env.KIT_PLUGIN_ROOT;
  if (dir) { try { const kj = JSON.parse(fs.readFileSync(path.join(dir, ".pipeline", "kit.json"), "utf8")); if (ok(kj.pluginRoot)) return kj.pluginRoot; } catch { /* sin registro */ } }
  if (ok(PREFERIDO)) return PREFERIDO;
  const h = os.homedir();
  const bases = sabor === "copilot"
    ? [process.env.COPILOT_HOME && path.join(process.env.COPILOT_HOME, "installed-plugins"), path.join(h, ".copilot", "installed-plugins")]
    : [process.env.CLAUDE_CONFIG_DIR && path.join(process.env.CLAUDE_CONFIG_DIR, "plugins"), path.join(h, ".claude", "plugins")];
  let best = null, bestVer = "", bestTime = 0;
  for (const b of bases.filter(Boolean)) for (const p of walk(b, 5)) {
    const m = manifest(p); if (m.sabor !== sabor) continue;
    const t = fs.statSync(p).mtimeMs, c = best ? cmpVer(m.version, bestVer) : 1;
    if (c > 0 || (c === 0 && t > bestTime)) { best = p; bestVer = m.version; bestTime = t; }
  }
  return best;
}
`;
}

// Lanzador de hooks de usuario (~/.copilot/bkit-hook.js): siempre el plugin de Copilot.
function hookLauncher({ preferred }) {
  return `#!/usr/bin/env node
// Lanzador de hooks del kit multiagente instalado a nivel de usuario. Generado por 'kit init' / 'kit update'; no editar.
// Localiza el plugin de Copilot y reenvía el evento; si no lo encuentra, permite (exit 0) para no bloquear otros proyectos.
"use strict";
${resolverSource({ preferred, flavor: "copilot", fixedFlavor: "copilot" })}
const plugin = findPlugin();
if (!plugin) process.exit(0);
const r = spawnSync(process.execPath, [path.join(plugin, "scripts", "hook.js"), process.argv[2] || ""], { stdio: "inherit", env: process.env });
process.exit(r.status == null ? 0 : r.status);
`;
}

// Comando global `kit` (~/.multiagent-kit/bin/kit-launcher.js): el plugin del sabor del proyecto.
function globalLauncher({ preferred, flavor }) {
  return `#!/usr/bin/env node
// Comando global del kit multiagente. Generado por 'kit init' / 'kit update'; se regenera en cada update. No editar.
"use strict";
${resolverSource({ preferred, flavor })}
const [cmd = "help", ...rest] = process.argv.slice(2);
const plugin = findPlugin();
if (cmd === "hook") {
  if (!plugin) process.exit(0);
  const r = spawnSync(process.execPath, [path.join(plugin, "scripts", "hook.js"), rest[0] || ""], { stdio: "inherit", env: process.env });
  process.exit(r.status == null ? 0 : r.status);
}
if (!plugin) {
  console.error("No encuentro el plugin del kit (" + saborBuscado(proyecto()) + ") instalado en este PC.");
  if (saborBuscado(proyecto()) === "claude") console.error("  Claude Code:  /plugin marketplace add carlosreyes222/multiagent-kit  ->  /plugin install multiagent-kit@carlos-kits");
  else console.error("  Copilot CLI:  copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot  ->  copilot plugin install bkit@bkit");
  console.error("(o define KIT_PLUGIN_ROOT con la ruta de una copia local del plugin)");
  process.exit(1);
}
if (cmd === "help" || cmd === "--help" || cmd === "-h") {
  const t = fs.readFileSync(path.join(plugin, "templates", "kit.js"), "utf8").split("\\n").filter((l) => /^\\/\\/   node kit\\.js/.test(l)).map((l) => l.replace(/^\\/\\/   node kit\\.js/, "  kit"));
  console.log("Kit multiagente — comandos (desde cualquier carpeta de un proyecto inicializado):\\n" + t.join("\\n") + "\\n\\nPlugin: " + plugin);
  process.exit(0);
}
require(path.join(plugin, "scripts", "cli.js")).main(cmd, rest).then((code) => process.exit(code || 0), (e) => { console.error("\\n" + (e && e.message ? e.message : e)); process.exit(1); });
`;
}

module.exports = { resolverSource, hookLauncher, globalLauncher };
