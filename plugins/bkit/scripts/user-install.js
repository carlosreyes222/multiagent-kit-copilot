// Instalación del kit a nivel de USUARIO (modo "usuario"): agentes, skills, prompts y hooks en tu perfil,
// válidos para todos los proyectos del PC, sin dejar nada en los repositorios.
//   Copilot CLI y VS Code:  ~/.copilot/agents/*.agent.md · ~/.copilot/skills/<nombre>/SKILL.md · ~/.copilot/hooks/bkit.json
//   VS Code (prompts y agentes de perfil): <User Data>/prompts/*.prompt.md, *.agent.md, kit.instructions.md
// Los hooks de usuario se lanzan con node "<home>/.copilot/bkit-hook.js" <nombre>, un lanzador que localiza el
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

// Lanzador de hooks: siempre el plugin de Copilot, empezando por la ruta de este plugin (ver launcher-src.js).
const LAUNCHER = require("./launcher-src").hookLauncher({ preferred: C.PLUGIN_ROOT });

// Archivos del kit en ~/.copilot, con el nombre del plugin (bkit; hasta la 2.x, multiagent-kit)
function userPaths(name = C.PLUGIN_NAME) {
  const home = copilotHome();
  return { home, manifest: path.join(home, `${name}-manifest.json`), launcher: path.join(home, `${name}-hook.js`), hooks: path.join(home, "hooks", `${name}.json`) };
}
// Cambio de nombre multiagent-kit -> bkit: retira el lanzador y la definición de hooks antiguos (si no, los hooks se
// ejecutarían dos veces) y hereda el manifiesto para seguir detectando los archivos que editaste. Devuelve lo retirado.
function retireOldNames(manifest) {
  const cur = userPaths();
  const retirados = [];
  for (const old of C.PLUGIN_NAMES.filter((n) => n !== C.PLUGIN_NAME)) {
    const o = userPaths(old);
    const om = C.readJson(o.manifest, null);
    if (om && om.files) for (const [k, v] of Object.entries(om.files)) if (!manifest.files[k]) manifest.files[k] = v;
    for (const f of [o.hooks, o.launcher, o.manifest]) {
      if (!fs.existsSync(f)) continue;
      try { fs.unlinkSync(f); } catch { try { fs.renameSync(f, f + ".retirado"); } catch { continue; } }
      retirados.push(f.replace(cur.home, "~/.copilot").replace(/\\/g, "/"));
      delete manifest.files[f.replace(/\\/g, "/")];
    }
  }
  return retirados;
}

function installUser({ update }) {
  const paths = userPaths();
  const home = paths.home;
  const manifestPath = paths.manifest;
  const manifest = C.readJson(manifestPath, { version: "", files: {} });
  if (!manifest.files) manifest.files = {};
  const creados = [], actualizados = [], modificados = [], avisos = [];
  const retirados = retireOldNames(manifest);

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
  const launcher = paths.launcher;
  put(LAUNCHER, launcher, `~/.copilot/${path.basename(launcher)}`);
  const cmd = (name) => `node "${launcher.replace(/\\/g, "/")}" ${name}`;
  const entry = (name, t) => ({ type: "command", command: cmd(name), bash: cmd(name), powershell: cmd(name), timeoutSec: t });
  const hooks = { version: 1, hooks: { SessionStart: [entry("session-start", 20)], PreToolUse: [entry("protect-main", 20), entry("commit-gate", 600)] } };
  put(JSON.stringify(hooks, null, 2) + "\n", paths.hooks, `~/.copilot/hooks/${path.basename(paths.hooks)}`);

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
  return { creados, actualizados, modificados, avisos, retirados, home, vscodeDir: vs };
}

module.exports = { installUser, copilotHome, vscodePromptsDir, userPaths };
