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

// Lanzador global: localiza el plugin del sabor del proyecto (ver launcher-src.js); lleva dentro la ruta de este plugin.
const LAUNCHER = require("./launcher-src").globalLauncher({ preferred: C.PLUGIN_ROOT, flavor: C.FLAVOR });

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
  if (process.env.KIT_NO_PATH) return { ok: true, already: true }; // pruebas: nunca tocar el PATH real del usuario
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
