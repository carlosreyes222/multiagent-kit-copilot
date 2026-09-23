// Utilidades de las pruebas: repositorios git temporales y ejecución de los scripts del plugin como lo hacen los hooks.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

// KIT_TEST_PLUGIN: probar otra copia del plugin (p. ej. una versión anterior, para comparar)
const PLUGIN = process.env.KIT_TEST_PLUGIN ? path.resolve(process.env.KIT_TEST_PLUGIN) : path.resolve(__dirname, "..", "plugins", "multiagent-kit");
const SCRIPTS = path.join(PLUGIN, "scripts");

// Entorno limpio y determinista para git y para los scripts del kit
const ENV = Object.assign({}, process.env, {
  GIT_AUTHOR_NAME: "kit-test", GIT_AUTHOR_EMAIL: "kit@test", GIT_COMMITTER_NAME: "kit-test", GIT_COMMITTER_EMAIL: "kit@test",
  GIT_CONFIG_NOSYSTEM: "1", KIT_NO_UPDATE_CHECK: "1", NO_COLOR: "1",
});
delete ENV.KIT_PROJECT_DIR;
delete ENV.CLAUDE_PROJECT_DIR;
delete ENV.KIT_PLUGIN_ROOT;
delete ENV.PIPELINE_SKIP_GATE;

function tmpDir(prefix) { return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); }
function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, env: ENV, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr || r.stdout}`);
  return (r.stdout || "").trim();
}
// Proyecto del kit: repo git en `main` con pipeline.config.json y un commit inicial.
function makeProject(config = {}, { branch } = {}) {
  const dir = tmpDir("kit-test-");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "core.autocrlf", "false");
  const cfg = Object.assign({ PROTECTED_BRANCHES: ["main", "develop", "release_*"], LINT_CMD: "", TEST_CMD: "", GATE_TESTS_ON_COMMIT: true }, config);
  fs.writeFileSync(path.join(dir, "pipeline.config.json"), JSON.stringify(cfg, null, 2));
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# proyecto\n");
  fs.writeFileSync(path.join(dir, ".gitignore"), ".pipeline/\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "init");
  if (branch) git(dir, "checkout", "-q", "-b", branch);
  return dir;
}
function writeState(dir, state) {
  fs.mkdirSync(path.join(dir, ".pipeline"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".pipeline", "state.json"), JSON.stringify(Object.assign({ schema_version: 2 }, state), null, 2));
}

// Eventos tal como los envían las superficies
const vscodeBash = (command, cwd) => ({ hook_event_name: "PreToolUse", tool_name: "run_in_terminal", tool_input: { command, explanation: "", isBackground: false }, cwd });
const cliBash = (command, cwd) => ({ toolName: "bash", toolArgs: JSON.stringify({ command }), cwd });
const cliPowershell = (command, cwd) => ({ toolName: "powershell", toolArgs: JSON.stringify({ command }), cwd });
const vscodeTool = (tool_name, tool_input, cwd) => ({ hook_event_name: "PreToolUse", tool_name, tool_input, cwd });
const cliTool = (toolName, args, cwd) => ({ toolName, toolArgs: JSON.stringify(args), cwd });

function runHook(name, event, { env } = {}) {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, "hook.js"), name], {
    input: JSON.stringify(event), cwd: event.cwd || process.cwd(), encoding: "utf8", env: Object.assign({}, ENV, env || {}),
  });
  return { code: r.status, stdout: r.stdout || "", stderr: r.stderr || "", denied: r.status === 2 };
}
// Ejecuta un comando del kit (lo mismo que `kit <cmd>`) en el proyecto.
function runKit(dir, args, { env } = {}) {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, "cli.js"), ...args], { cwd: dir, encoding: "utf8", env: Object.assign({}, ENV, env || {}) });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
function rm(dir) { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); } catch { /* Windows: archivo aún abierto */ } }

module.exports = { PLUGIN, SCRIPTS, ENV, tmpDir, git, makeProject, writeState, vscodeBash, cliBash, cliPowershell, vscodeTool, cliTool, runHook, runKit, rm };
