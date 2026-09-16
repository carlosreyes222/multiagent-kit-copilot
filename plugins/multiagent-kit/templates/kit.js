#!/usr/bin/env node
// Lanzador de los scripts del kit multiagente desde la raíz del proyecto. Igual en Windows, macOS y Linux (Node >= 18).
// Los scripts viven en el plugin instalado y se actualizan con él; este archivo solo los localiza.
//   node kit.js check                       -> verifica herramientas y configuración
//   node kit.js staging [--feature slug]    -> despliega a staging (proveedor según pipeline.config.json)
//   node kit.js smoke                       -> smoke tests contra staging
//   node kit.js prod [--yes]                -> promover a producción (pide escribir PRODUCCION)
//   node kit.js status                      -> estado del pipeline (.pipeline/state.json)
//   node kit.js state clave=valor ...       -> actualizar el estado (lo usan los agentes)
//   node kit.js init                        -> (re)inicializa archivos del proyecto sin sobrescribir los tuyos
//   node kit.js update                      -> refresca los archivos gestionados por el kit
//   node kit.js migrate                     -> convierte pipeline.config.ps1 (antiguo) en pipeline.config.json
//   node kit.js sdk <list|sync|pack|status>  -> SDKs del equipo declarados en SDKS: sincronizar, empaquetar y enlazar en el padre
//   node kit.js hook <nombre>               -> (lo usan los hooks) reenvía el evento al script del plugin
//   node kit.js version                     -> versión del plugin y de los archivos del proyecto
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const PROJECT = __dirname;
process.env.KIT_PROJECT_DIR = PROJECT;

function isPlugin(dir) {
  if (!dir || !fs.existsSync(path.join(dir, "scripts", "common.js"))) return false;
  for (const rel of ["plugin.json", ".claude-plugin/plugin.json"]) {
    const m = path.join(dir, rel);
    if (fs.existsSync(m)) { try { return JSON.parse(fs.readFileSync(m, "utf8")).name === "multiagent-kit"; } catch { return false; } }
  }
  return false;
}
function* walk(dir, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    // Claude Code instala en ~/.claude/plugins/cache/<marketplace>/<plugin>/<versión>/; Copilot en installed-plugins/<marketplace>/<plugin>/
    if (isPlugin(p)) yield p;
    else yield* walk(p, depth - 1);
  }
}
function findPluginRoot() {
  if (isPlugin(process.env.KIT_PLUGIN_ROOT)) return process.env.KIT_PLUGIN_ROOT;
  try {
    const kj = JSON.parse(fs.readFileSync(path.join(PROJECT, ".pipeline", "kit.json"), "utf8"));
    if (isPlugin(kj.pluginRoot)) return kj.pluginRoot;
  } catch { /* sin registro local */ }
  const home = os.homedir();
  const bases = [
    process.env.COPILOT_HOME && path.join(process.env.COPILOT_HOME, "installed-plugins"),
    path.join(home, ".copilot", "installed-plugins"),
    path.join(home, ".claude", "plugins"),
  ].filter(Boolean);
  let best = null, bestTime = 0;
  for (const b of bases) for (const p of walk(b, 5)) {
    const t = fs.statSync(p).mtimeMs;
    if (t > bestTime) { best = p; bestTime = t; }
  }
  return best;
}

const [cmd = "help", ...rest] = process.argv.slice(2);
const plugin = findPluginRoot();

if (cmd === "hook") {
  // Los hooks nunca deben romper la sesión si el plugin no está: avisan y permiten.
  const name = rest[0] || "";
  if (!plugin) { process.stderr.write(`kit.js: plugin multiagent-kit no instalado; hook '${name}' omitido.\n`); process.exit(0); }
  const r = spawnSync(process.execPath, [path.join(plugin, "scripts", "hook.js"), name], { stdio: "inherit", env: process.env });
  process.exit(r.status == null ? 0 : r.status);
}
if (cmd === "help" || cmd === "--help" || cmd === "-h") {
  const lines = fs.readFileSync(__filename, "utf8").split("\n").slice(1, 15).map((l) => l.replace(/^\/\/ ?/, ""));
  console.log(lines.join("\n"));
  process.exit(0);
}
if (!plugin) {
  console.error("No encuentro el plugin multiagent-kit. Instálalo:");
  console.error("  Claude Code:  /plugin marketplace add carlosreyes222/multiagent-kit  ->  /plugin install multiagent-kit@carlos-kits");
  console.error("  Copilot CLI:  copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot  ->  copilot plugin install multiagent-kit@carlos-kits-copilot");
  console.error("(o define KIT_PLUGIN_ROOT con la ruta de una copia local del plugin)");
  process.exit(1);
}
require(path.join(plugin, "scripts", "cli.js")).main(cmd, rest).then((code) => process.exit(code || 0), (e) => { console.error("\n" + (e && e.message ? e.message : e)); process.exit(1); });
