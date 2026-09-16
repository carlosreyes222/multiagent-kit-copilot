// Instalación del kit a nivel de USUARIO (modo "usuario"): agentes, skills, prompts y hooks en tu perfil,
// válidos para todos los proyectos del PC, sin dejar nada en los repositorios.
//   Copilot CLI y VS Code:  ~/.copilot/agents/*.agent.md · ~/.copilot/skills/<nombre>/SKILL.md · ~/.copilot/hooks/multiagent-kit.json
//   VS Code (prompts y agentes de perfil): <User Data>/prompts/*.prompt.md, *.agent.md, kit.instructions.md
// Los hooks de usuario se lanzan con node "<home>/.copilot/multiagent-kit-hook.js" <nombre>, un lanzador que localiza el
// plugin instalado y NO hace nada (exit 0) en proyectos sin pipeline.config.json, así no interfiere en otros repos.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const C = require("./common");

function copilotHome() { return process.env.COPILOT_HOME || path.join(os.homedir(), ".copilot"); }
function vscodePromptsDir() {
  if (process.env.KIT_VSCODE_PROMPTS_DIR) return process.env.KIT_VSCODE_PROMPTS_DIR;
  const h = os.homedir();
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(h, "AppData", "Roaming"), "Code", "User", "prompts");
  if (process.platform === "darwin") return path.join(h, "Library", "Application Support", "Code", "User", "prompts");
  return path.join(h, ".config", "Code", "User", "prompts");
}

const LAUNCHER = `#!/usr/bin/env node
// Lanzador de hooks del kit multiagente instalado a nivel de usuario. Generado por 'node kit.js init --modo usuario'.
// Localiza el plugin instalado y reenvía el evento; si no hay plugin, permite (exit 0) para no bloquear otros proyectos.
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
function isPlugin(d) {
  if (!d || !fs.existsSync(path.join(d, "scripts", "hook.js"))) return false;
  for (const rel of ["plugin.json", ".claude-plugin/plugin.json"]) { const m = path.join(d, rel);
    if (fs.existsSync(m)) { try { return JSON.parse(fs.readFileSync(m, "utf8")).name === "multiagent-kit"; } catch { return false; } } }
  return false;
}
function* walk(dir, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return;
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of es) { if (!e.isDirectory()) continue; const p = path.join(dir, e.name); if (isPlugin(p)) yield p; else yield* walk(p, depth - 1); }
}
let plugin = isPlugin(process.env.KIT_PLUGIN_ROOT) ? process.env.KIT_PLUGIN_ROOT : null;
if (!plugin) {
  const h = os.homedir(); let best = 0;
  for (const b of [process.env.COPILOT_HOME && path.join(process.env.COPILOT_HOME, "installed-plugins"), path.join(h, ".copilot", "installed-plugins"), path.join(h, ".claude", "plugins")].filter(Boolean))
    for (const p of walk(b, 5)) { const t = fs.statSync(p).mtimeMs; if (t > best) { best = t; plugin = p; } }
}
if (!plugin) process.exit(0);
const r = spawnSync(process.execPath, [path.join(plugin, "scripts", "hook.js"), process.argv[2] || ""], { stdio: "inherit", env: process.env });
process.exit(r.status == null ? 0 : r.status);
`;

function installUser({ update }) {
  const home = copilotHome();
  const manifestPath = path.join(home, "multiagent-kit-manifest.json");
  const manifest = C.readJson(manifestPath, { version: "", files: {} });
  if (!manifest.files) manifest.files = {};
  const creados = [], actualizados = [], modificados = [], avisos = [];

  const put = (srcAbsOrText, dstAbs, label) => {
    fs.mkdirSync(path.dirname(dstAbs), { recursive: true });
    const isText = typeof srcAbsOrText === "string" && !fs.existsSync(srcAbsOrText);
    const srcHash = isText ? require("crypto").createHash("sha256").update(srcAbsOrText).digest("hex") : C.sha256(srcAbsOrText);
    const write = () => (isText ? fs.writeFileSync(dstAbs, srcAbsOrText, "utf8") : fs.copyFileSync(srcAbsOrText, dstAbs));
    const key = dstAbs.replace(/\\/g, "/");
    if (!fs.existsSync(dstAbs)) { write(); creados.push(label); manifest.files[key] = srcHash; return; }
    const cur = C.sha256(dstAbs);
    if (cur === srcHash) { manifest.files[key] = srcHash; return; }
    if (manifest.files[key] && cur === manifest.files[key]) { write(); actualizados.push(label); manifest.files[key] = srcHash; }
    else { isText ? fs.writeFileSync(dstAbs + ".kit", srcAbsOrText, "utf8") : fs.copyFileSync(srcAbsOrText, dstAbs + ".kit"); modificados.push(`${label}  (nueva versión en ${label}.kit)`); }
  };

  // Agentes y skills para Copilot CLI (y VS Code lee también ~/.copilot/hooks)
  const agentsDir = path.join(C.PLUGIN_ROOT, "com.github.copilot", "agents");
  const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".agent.md"));
  for (const f of agentFiles) put(path.join(agentsDir, f), path.join(home, "agents", f), `~/.copilot/agents/${f}`);
  for (const d of fs.readdirSync(path.join(C.PLUGIN_ROOT, "skills"))) {
    const sk = path.join(C.PLUGIN_ROOT, "skills", d, "SKILL.md");
    if (fs.existsSync(sk)) put(sk, path.join(home, "skills", d, "SKILL.md"), `~/.copilot/skills/${d}/SKILL.md`);
  }
  // Lanzador y hooks de usuario
  const launcher = path.join(home, "multiagent-kit-hook.js");
  put(LAUNCHER, launcher, "~/.copilot/multiagent-kit-hook.js");
  const cmd = (name) => `node "${launcher.replace(/\\/g, "/")}" ${name}`;
  const entry = (name, t) => ({ type: "command", command: cmd(name), bash: cmd(name), powershell: cmd(name), timeoutSec: t });
  const hooks = { version: 1, hooks: { SessionStart: [entry("session-start", 20)], PreToolUse: [entry("protect-main", 20), entry("commit-gate", 600)] } };
  put(JSON.stringify(hooks, null, 2) + "\n", path.join(home, "hooks", "multiagent-kit.json"), "~/.copilot/hooks/multiagent-kit.json");

  // VS Code: prompts, agentes e instrucciones de perfil de usuario
  const vs = vscodePromptsDir();
  const vsParent = path.dirname(vs);
  if (fs.existsSync(vsParent) || process.env.KIT_VSCODE_PROMPTS_DIR) {
    const tplPrompts = path.join(C.PLUGIN_ROOT, "templates", "github", "prompts");
    for (const f of fs.readdirSync(tplPrompts)) if (f.endsWith(".prompt.md")) put(path.join(tplPrompts, f), path.join(vs, f), `VS Code prompts/${f}`);
    for (const f of agentFiles) put(path.join(agentsDir, f), path.join(vs, f), `VS Code prompts/${f}`);
    put(path.join(C.PLUGIN_ROOT, "templates", "github", "instructions", "kit.instructions.md"), path.join(vs, "kit.instructions.md"), "VS Code prompts/kit.instructions.md");
  } else {
    avisos.push(`No encontré la carpeta de usuario de VS Code (${vsParent}); los prompts y agentes de VS Code no se instalaron. Si usas VS Code, define KIT_VSCODE_PROMPTS_DIR con la carpeta 'User/prompts' y repite.`);
  }

  const files = {}; for (const k of Object.keys(manifest.files).sort()) files[k] = manifest.files[k];
  C.writeJson(manifestPath, { version: C.VERSION, updatedAt: C.nowIso(), files });
  return { creados, actualizados, modificados, avisos, home, vscodeDir: vs };
}

module.exports = { installUser, copilotHome, vscodePromptsDir };
