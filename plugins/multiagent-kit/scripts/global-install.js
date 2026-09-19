// Instalación global por máquina (una vez por PC, la hace cualquier init/update):
//   ~/.multiagent-kit/bin/kit (+ kit.cmd en Windows) -> comando `kit` en cualquier proyecto, sin kit.js en el repo
//   ~/.claude/settings.json (solo kit de Claude)      -> permisos del kit fusionados en tu configuración de usuario
// Las plantillas de documentos NO se copian: los agentes las leen del plugin (ruta en .pipeline/kit.json → pluginRoot).
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const C = require("./common");
const R = require("./remote");

function binDir() { return path.join(R.kitHome(), "bin"); }

// Lanzador global: igual que templates/kit.js pero sin proyecto fijo (lo busca desde el cwd hacia arriba).
const LAUNCHER = `#!/usr/bin/env node
// Comando global del kit multiagente. Generado por 'kit init'; se regenera en cada update. No editar.
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
function isPlugin(dir) {
  if (!dir || !fs.existsSync(path.join(dir, "scripts", "common.js"))) return false;
  for (const rel of ["plugin.json", ".claude-plugin/plugin.json"]) { const m = path.join(dir, rel);
    if (fs.existsSync(m)) { try { return JSON.parse(fs.readFileSync(m, "utf8")).name === "multiagent-kit"; } catch { return false; } } }
  return false;
}
function* walk(dir, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return;
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of es) { if (!e.isDirectory()) continue; const p = path.join(dir, e.name); if (isPlugin(p)) yield p; else yield* walk(p, depth - 1); }
}
function projectKitJson() {
  let d = process.cwd();
  for (;;) { const f = path.join(d, ".pipeline", "kit.json"); if (fs.existsSync(f)) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } } const p = path.dirname(d); if (p === d) return null; d = p; }
}
function findPlugin() {
  if (isPlugin(process.env.KIT_PLUGIN_ROOT)) return process.env.KIT_PLUGIN_ROOT;
  const home = os.homedir();
  let best = null, bestTime = 0;
  const bases = [process.env.COPILOT_HOME && path.join(process.env.COPILOT_HOME, "installed-plugins"), path.join(home, ".copilot", "installed-plugins"), path.join(home, ".claude", "plugins")].filter(Boolean);
  for (const b of bases) for (const p of walk(b, 5)) { const t = fs.statSync(p).mtimeMs; if (t > bestTime) { best = p; bestTime = t; } }
  if (best) return best;
  const kj = projectKitJson();
  return kj && isPlugin(kj.pluginRoot) ? kj.pluginRoot : null;
}
const [cmd = "help", ...rest] = process.argv.slice(2);
const plugin = findPlugin();
if (cmd === "hook") {
  if (!plugin) process.exit(0);
  const r = spawnSync(process.execPath, [path.join(plugin, "scripts", "hook.js"), rest[0] || ""], { stdio: "inherit", env: process.env });
  process.exit(r.status == null ? 0 : r.status);
}
if (!plugin) {
  console.error("No encuentro el plugin multiagent-kit instalado en este PC.");
  console.error("  Claude Code:  /plugin marketplace add carlosreyes222/multiagent-kit  ->  /plugin install multiagent-kit@carlos-kits");
  console.error("  Copilot CLI:  copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot  ->  copilot plugin install multiagent-kit@carlos-kits-copilot");
  process.exit(1);
}
if (cmd === "help" || cmd === "--help" || cmd === "-h") {
  const t = fs.readFileSync(path.join(plugin, "templates", "kit.js"), "utf8").split("\\n").filter((l) => /^\\/\\/   node kit\\.js/.test(l)).map((l) => l.replace(/^\\/\\/   node kit\\.js/, "  kit"));
  console.log("Kit multiagente — comandos (desde cualquier carpeta de un proyecto inicializado):\\n" + t.join("\\n"));
  process.exit(0);
}
require(path.join(plugin, "scripts", "cli.js")).main(cmd, rest).then((code) => process.exit(code || 0), (e) => { console.error("\\n" + (e && e.message ? e.message : e)); process.exit(1); });
`;

function installBin() {
  const dir = binDir();
  fs.mkdirSync(dir, { recursive: true });
  const js = path.join(dir, "kit-launcher.js");
  const prev = fs.existsSync(js) ? fs.readFileSync(js, "utf8") : "";
  if (prev !== LAUNCHER) fs.writeFileSync(js, LAUNCHER, "utf8");
  const sh = path.join(dir, "kit");
  const shTxt = '#!/bin/sh\nexec node "$(dirname "$0")/kit-launcher.js" "$@"\n';
  if (!fs.existsSync(sh) || fs.readFileSync(sh, "utf8") !== shTxt) fs.writeFileSync(sh, shTxt, "utf8");
  try { fs.chmodSync(sh, 0o755); } catch { /* Windows */ }
  if (C.IS_WIN) {
    const cmd = path.join(dir, "kit.cmd");
    const cmdTxt = '@echo off\r\nnode "%~dp0kit-launcher.js" %*\r\n';
    if (!fs.existsSync(cmd) || fs.readFileSync(cmd, "utf8") !== cmdTxt) fs.writeFileSync(cmd, cmdTxt, "utf8");
  }
  return { dir, changed: prev !== LAUNCHER };
}

function onPath(dir) {
  const sep = C.IS_WIN ? ";" : ":";
  const norm = (p) => path.resolve(p).replace(/[\\/]+$/, "").toLowerCase();
  return (process.env.PATH || "").split(sep).filter(Boolean).some((p) => norm(p) === norm(dir));
}
// Añade ~/.multiagent-kit/bin al PATH del usuario (Windows: variable de usuario; mac/linux: línea en el rc del shell).
function ensurePath(dir) {
  if (onPath(dir)) return { ok: true, already: true };
  if (C.IS_WIN) {
    const ps = `$d='${dir.replace(/'/g, "''")}'; $u=[Environment]::GetEnvironmentVariable('Path','User'); if(($u -split ';') -notcontains $d){ [Environment]::SetEnvironmentVariable('Path', (($u.TrimEnd(';')) + ';' + $d), 'User'); 'added' } else { 'present' }`;
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8" });
    return { ok: r.status === 0, already: /present/.test(r.stdout || ""), how: `abre una terminal nueva para que cargue el PATH (o añade a mano ${dir})` };
  }
  const shell = path.basename(process.env.SHELL || "");
  const rc = path.join(os.homedir(), shell === "zsh" ? ".zshrc" : shell === "fish" ? ".config/fish/config.fish" : ".bashrc");
  const line = shell === "fish" ? `fish_add_path ${dir}` : `export PATH="${dir}:$PATH"  # multiagent-kit`;
  try {
    const cur = fs.existsSync(rc) ? fs.readFileSync(rc, "utf8") : "";
    if (!cur.includes(dir)) fs.appendFileSync(rc, `\n${line}\n`, "utf8");
    return { ok: true, already: cur.includes(dir), how: `ejecuta: source ${rc}  (o abre una terminal nueva)` };
  } catch (e) { return { ok: false, how: `añade a mano al PATH: ${dir} (${e.message})` }; }
}

// --- Claude Code: permisos del kit en ~/.claude/settings.json (fusión, sin tocar lo demás) --------------
const CLAUDE_ALLOW = ["Read", "Grep", "Glob", "Edit", "Write",
  "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git add*)", "Bash(git commit*)", "Bash(git checkout*)", "Bash(git switch*)", "Bash(git branch*)", "Bash(git worktree*)",
  "Bash(docker compose*)", "Bash(docker ps*)", "Bash(docker logs*)", "Bash(supabase --version*)", "Bash(supabase migration list*)", "Bash(supabase functions list*)",
  "Bash(kit check*)", "Bash(kit staging*)", "Bash(kit smoke*)", "Bash(kit status*)", "Bash(kit state *)", "Bash(kit sdk *)", "Bash(kit epica*)", "Bash(kit update*)", "Bash(kit init*)", "Bash(kit version*)", "Bash(kit doctor*)", "Bash(kit lecciones*)", "Bash(kit plantilla*)",
  "Bash(node kit.js check*)", "Bash(node kit.js staging*)", "Bash(node kit.js smoke*)", "Bash(node kit.js status*)", "Bash(node kit.js state *)", "Bash(node kit.js sdk *)", "Bash(node kit.js epica*)", "Bash(node kit.js update*)", "Bash(node kit.js init*)", "Bash(node kit.js version*)", "Bash(node kit.js doctor*)", "Bash(node kit.js lecciones*)", "Bash(node kit.js plantilla*)"];
const CLAUDE_DENY = ["Bash(git push*--force*)", "Bash(git push*-f *)", "Bash(git reset --hard*)", "Bash(rm -rf*)", "Bash(Remove-Item*-Recurse*)", "Bash(docker system prune*)",
  "Bash(supabase db push*)", "Bash(supabase functions deploy*)", "Bash(supabase db reset*)", "Bash(docker compose*down*-v*)", "Bash(docker volume rm*)",
  "Read(./.env)", "Read(./.env.*)", "Read(./**/secrets*)", "Edit(./.env)", "Edit(./.env.*)",
  "Bash(kit prod*)", "Bash(*kit.js prod*)", "Bash(*scripts/prod.js*)", "Bash(kit sdk publish*)", "Bash(*kit.js sdk publish*)"];
function claudeSettingsPath() { return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "settings.json"); }
function mergeClaudeSettings() {
  const p = claudeSettingsPath();
  let s = {}; if (fs.existsSync(p)) { try { s = JSON.parse(fs.readFileSync(p, "utf8")); } catch { return { ok: false, error: `${p} no es JSON válido; no lo toco` }; } }
  s.permissions = s.permissions || {};
  const allow = Array.isArray(s.permissions.allow) ? s.permissions.allow : [], deny = Array.isArray(s.permissions.deny) ? s.permissions.deny : [];
  const addA = CLAUDE_ALLOW.filter((x) => !allow.includes(x)), addD = CLAUDE_DENY.filter((x) => !deny.includes(x));
  s.extraKnownMarketplaces = s.extraKnownMarketplaces || {};
  if (!s.extraKnownMarketplaces["carlos-kits"]) s.extraKnownMarketplaces["carlos-kits"] = { source: { source: "github", repo: "carlosreyes222/multiagent-kit" } };
  s.enabledPlugins = s.enabledPlugins || {};
  const hadPlugin = s.enabledPlugins["multiagent-kit@carlos-kits"] === true;
  s.enabledPlugins["multiagent-kit@carlos-kits"] = true;
  if (addA.length || addD.length || !hadPlugin) {
    s.permissions.allow = allow.concat(addA); s.permissions.deny = deny.concat(addD);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(s, null, 2) + "\n", "utf8");
  }
  return { ok: true, path: p, added: addA.length + addD.length };
}
function claudeSettingsMissing() {
  const p = claudeSettingsPath();
  let s = {}; try { s = JSON.parse(fs.readFileSync(p, "utf8")); } catch { return CLAUDE_ALLOW.concat(CLAUDE_DENY); }
  const allow = (s.permissions && s.permissions.allow) || [], deny = (s.permissions && s.permissions.deny) || [];
  return CLAUDE_ALLOW.filter((x) => !allow.includes(x)).concat(CLAUDE_DENY.filter((x) => !deny.includes(x)));
}

// Instalación global completa. Devuelve mensajes para mostrar.
function installGlobal({ quiet = false } = {}) {
  const out = [];
  const b = installBin();
  const pr = ensurePath(b.dir);
  out.push(`comando global 'kit' en ${b.dir}${pr.already ? " (ya en el PATH)" : pr.ok ? " — añadido al PATH; " + pr.how : " — NO pude añadirlo al PATH: " + pr.how}`);
  if (C.FLAVOR === "claude") {
    const m = mergeClaudeSettings();
    out.push(m.ok ? `permisos del kit en ${m.path}${m.added ? ` (+${m.added})` : " (al día)"}` : `permisos: ${m.error}`);
  }
  if (!quiet) out.forEach((o) => C.log.ok(o));
  return { bin: b.dir, pathOk: pr.ok || pr.already, messages: out };
}

module.exports = { installGlobal, installBin, ensurePath, onPath, binDir, mergeClaudeSettings, claudeSettingsMissing, claudeSettingsPath, CLAUDE_ALLOW, CLAUDE_DENY };
