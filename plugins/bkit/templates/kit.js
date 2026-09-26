#!/usr/bin/env node
// Lanzador de los scripts del kit multiagente desde la raíz del proyecto. Igual en Windows, macOS y Linux (Node >= 18).
// Los scripts viven en el plugin instalado y se actualizan con él; este archivo solo los localiza.
//   node kit.js check                       -> verifica herramientas (Node, git, gh, toolchain RN) y configuración
//   node kit.js pr --feature <slug> --base <rama> -> sube la rama y abre el pull request (fin del flujo)
//   node kit.js status                      -> estado del pipeline (.pipeline/state.json)
//   node kit.js state clave=valor ...       -> actualizar el estado (lo usan los agentes)
//   node kit.js init                        -> (re)inicializa archivos del proyecto sin sobrescribir los tuyos
//   node kit.js update                      -> refresca los archivos gestionados por el kit
//   node kit.js migrate                     -> convierte pipeline.config.ps1 (antiguo) en pipeline.config.json
//   node kit.js sdk <list|sync|pack|api|publish|status> -> SDKs del equipo (SDKS): sincronizar, empaquetar, breaking changes, publicar
//   node kit.js epica <list|status|next|add|set>  -> idea partida en varias HU (docs/epicas/<nombre>.md): progreso y siguiente HU
//   node kit.js doctor [--fix]              -> diagnóstico del kit (plugin, proyecto, hooks, permisos, restos) y arreglos seguros
//   node kit.js lecciones [add "…"]         -> lecciones reutilizables entre proyectos (~/.multiagent-kit/lecciones.md)
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
  // Solo el plugin de Copilot (plugin.json en la raíz); el de Claude Code se llama igual pero usa .claude-plugin/
  const m = path.join(dir, "plugin.json");
  try { return ["multiagent-kit", "bkit"].includes(JSON.parse(fs.readFileSync(m, "utf8")).name); } catch { return false; }
}
function* walk(dir, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    // Copilot instala en installed-plugins/<marketplace>/<plugin>/
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
  if (!plugin) { process.stderr.write(`kit.js: plugin del kit no instalado; hook '${name}' omitido.\n`); process.exit(0); }
  const r = spawnSync(process.execPath, [path.join(plugin, "scripts", "hook.js"), name], { stdio: "inherit", env: process.env });
  process.exit(r.status == null ? 0 : r.status);
}
if (cmd === "help" || cmd === "--help" || cmd === "-h") {
  const lines = fs.readFileSync(__filename, "utf8").split("\n").slice(1, 18).map((l) => l.replace(/^\/\/ ?/, ""));
  console.log(lines.join("\n"));
  process.exit(0);
}
if (!plugin) {
  console.error("No encuentro el plugin del kit. Instálalo:");
  console.error("  Copilot CLI:  copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot  ->  copilot plugin install bkit@bkit");
  console.error("(o define KIT_PLUGIN_ROOT con la ruta de una copia local del plugin)");
  process.exit(1);
}
require(path.join(plugin, "scripts", "cli.js")).main(cmd, rest).then((code) => process.exit(code || 0), (e) => { console.error("\n" + (e && e.message ? e.message : e)); process.exit(1); });
