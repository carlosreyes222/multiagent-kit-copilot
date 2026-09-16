// Hooks del kit (Claude Code y GitHub Copilot). Uso: node hook.js <protect-main|commit-gate|session-start>
// Lee el evento JSON por stdin en cualquiera de los formatos:
//   Claude Code / VS Code (PascalCase): { hook_event_name, tool_name, tool_input: {command|file_path}, cwd }
//   Copilot CLI / cloud agent (camelCase): { toolName, toolArgs (cadena JSON), cwd }
// Denegar: escribe JSON {permissionDecision:"deny"} (Copilot), mensaje en stderr y sale con 2 (Claude/VS Code).
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./common");

function readEvent() {
  try { const raw = fs.readFileSync(0, "utf8"); return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; }
}
function normalize(evt) {
  const r = { tool: "other", command: "", file: "", cwd: evt.cwd || "" };
  let name = "", args = null;
  if ("toolName" in evt) { name = String(evt.toolName || ""); args = evt.toolArgs; }
  else if ("tool_name" in evt) { name = String(evt.tool_name || ""); args = evt.tool_input; }
  if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = null; } }
  const n = name.toLowerCase();
  if (["bash", "powershell", "shell", "execute", "runinterminal", "run_in_terminal"].includes(n)) r.tool = "bash";
  else if (["view", "read", "readfile", "read_file", "cat"].includes(n)) r.tool = "read";
  else if (["edit", "create", "write", "str_replace_editor", "apply_patch", "multiedit", "editfile", "createfile", "edit_file", "create_file"].includes(n)) r.tool = "edit";
  if (args && typeof args === "object") {
    for (const k of ["command", "commandLine", "cmd", "script"]) if (args[k]) { r.command = String(args[k]); break; }
    for (const k of ["file_path", "filePath", "path", "file", "target_file", "targetFile"]) if (args[k]) { r.file = String(args[k]); break; }
  }
  return r;
}
function deny(reason) {
  process.stdout.write(JSON.stringify({ permissionDecision: "deny", permissionDecisionReason: reason }) + "\n");
  process.stderr.write("BLOQUEADO: " + reason + "\n");
  process.exit(2);
}

// Carpeta sobre la que actúa un comando git: `git -C <dir> …` o `cd <dir> && …` (los agentes trabajan así en los SDKs).
function gitTargetDir(a, root) {
  const base = a.cwd && fs.existsSync(a.cwd) ? a.cwd : root;
  const cmd = a.command || "";
  const m = /git\s+-C\s+("([^"]+)"|'([^']+)'|(\S+))/.exec(cmd) || /(?:^|&&|;|\|\|)\s*(?:cd|Set-Location|pushd)\s+("([^"]+)"|'([^']+)'|(\S+))\s*(?:&&|;)/.exec(cmd);
  const dir = m ? path.resolve(base, m[2] || m[3] || m[4]) : base;
  return fs.existsSync(dir) ? dir : base;
}
function sdkFor(root, cfg, dir) {
  try {
    const S = require("./sdk");
    for (const s of S.declared(cfg)) {
      if (S.validate(s).length) continue;
      let d; try { d = S.resolveDir(root, s).dir; } catch { continue; }
      if (path.resolve(dir).toLowerCase().startsWith(path.resolve(d).toLowerCase())) return Object.assign({ dir: d }, s);
    }
  } catch { /* sin SDKs */ }
  return null;
}

function protectMain(a, root, cfg) {
  const protectedRe = (cfg.PROTECTED_BRANCHES || []).map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (["read", "edit"].includes(a.tool) && a.file) {
    const p = a.file.replace(/\\/g, "/");
    if (/(^|\/)\.env(\.[^/]+)?$/.test(p) && !/\.example$/.test(p) && !/\/staging\/\.env\.staging$/.test(p))
      deny(`los agentes no leen ni editan archivos .env (${p}). Usa variables de entorno o el .env.example.`);
    if (/\.(jks|keystore|p12|pem|pfx)$/.test(p) || /(^|\/)google-services\.json$/.test(p))
      deny(`archivo sensible (${p}): los agentes no lo leen ni lo modifican.`);
  }
  if (a.tool !== "bash" || !a.command) return;
  const cmd = a.command;
  const target = gitTargetDir(a, root);
  const branch = C.currentBranch(target); // rama del repo sobre el que actúa el comando (padre o SDK)
  if (/kit\.(js|ps1)\s+prod\b/.test(cmd) || /promote-prod\.(js|ps1)/.test(cmd) || /scripts[\\/]prod\.js/.test(cmd))
    deny("la promoción a producción ('node kit.js prod') solo la ejecuta una persona desde su terminal.");
  if (/supabase\s+(db\s+push|functions\s+deploy|db\s+reset)\b/.test(cmd))
    deny("despliegues a Supabase solo a través de 'node kit.js staging' (staging) o 'node kit.js prod' (persona).");
  if (/git\s+push\b.*(--force\b|\s-f\b|--force-with-lease)/.test(cmd) || /git\s+reset\s+--hard/.test(cmd) || /\brm\s+-rf\b/.test(cmd) ||
      /Remove-Item\b.*-Recurse/.test(cmd) || /docker\s+system\s+prune/.test(cmd) || /docker\s+volume\s+rm/.test(cmd) || /docker\s+compose\b.*\bdown\b.*(\s-v\b|--volumes)/.test(cmd))
    deny(`comando destructivo no permitido a los agentes: ${cmd}`);
  const onProtected = protectedRe && new RegExp(`^(${protectedRe})$`).test(branch);
  if ((protectedRe && new RegExp(`git\\s+push\\b.*\\b(${protectedRe})\\b`).test(cmd)) || (/git\s+push\b/.test(cmd) && onProtected))
    deny(`no se permite 'git push' a ramas protegidas (${(cfg.PROTECTED_BRANCHES || []).join(", ")}). Abre un PR desde una rama feature/*.`);
  if (/git\s+commit\b/.test(cmd) && onProtected) deny(`estás en '${branch}'. Crea una rama: git checkout -b feature/<nombre>`);
  if (/git\s+merge\b/.test(cmd) && onProtected) {
    const feature = C.getState(root).feature || "";
    if (C.securityVerdict(root, feature) !== "APROBADO") deny(`merge a '${branch}' requiere 'VEREDICTO: APROBADO' en docs/reviews/${feature}-seguridad.md`);
  }
}

function commitGate(a, root, cfg) {
  if (a.tool !== "bash" || !/git\s+commit\b/.test(a.command)) return;
  if (cfg.GATE_TESTS_ON_COMMIT === false || process.env.PIPELINE_SKIP_GATE === "1") return;
  // Commit dentro de un SDK declarado: se usan los comandos lint/test del SDK (si los declaró), no los del padre.
  const target = gitTargetDir(a, root);
  let cwd = root, gates = [["Lint", cfg.LINT_CMD], ["Tests", cfg.TEST_CMD]];
  if (path.resolve(target) !== path.resolve(root)) {
    const s = sdkFor(root, cfg, target);
    if (!s) return; // otro repositorio ajeno al kit
    cwd = s.dir; gates = [["Lint (SDK)", s.lint], ["Tests (SDK)", s.test]];
    if (!gates.some(([, c]) => c && String(c).trim())) { process.stdout.write(`{"type": "progress", "message": "Kit: commit en el SDK ${s.nombre} sin lint/test declarados en SDKS; compuerta omitida."}\n`); return; }
  }
  process.stdout.write('{"type": "progress", "message": "Kit: compuerta de commit (lint + tests)..."}\n');
  for (const [label, cmd] of gates) {
    if (!cmd || !String(cmd).trim()) continue;
    const r = C.run(cmd, { cwd, ignoreFailure: true, quiet: true });
    if (r.code !== 0) {
      const tail = r.out.split(/\r?\n/).filter(Boolean).slice(-40).join("\n");
      deny(`COMMIT BLOQUEADO: ${label} falló (${cmd}). Últimas líneas:\n${tail}`);
    }
  }
}

function sessionStart(root) {
  let msg;
  if (!root) {
    msg = `Kit multiagente (${C.FLAVOR}) v${C.VERSION} instalado, pero este proyecto no está inicializado. Si el usuario quiere usarlo aquí, ejecuta ${C.FLAVOR === "claude" ? "/multiagent-kit:init" : "/kit-init"}.`;
  } else {
    const kitJson = path.join(root, ".pipeline", "kit.json");
    const prev = C.readJson(kitJson, {});
    C.writeJson(kitJson, { pluginRoot: C.PLUGIN_ROOT, version: C.VERSION, projectFilesVersion: prev.projectFilesVersion || "", updatedAt: C.nowIso() });
    const cfg = C.loadConfig(root);
    msg = `Kit multiagente (${C.FLAVOR}) v${C.VERSION} activo. Staging: ${cfg.STAGING_PROVIDER}. Comandos del kit: node kit.js <check|staging|smoke|status|state|update> (iguales en Windows, macOS y Linux). Flujos: /pipeline, /analisis, /bugfix, /ideas, /deploy-staging, /promote-prod.`;
    if (Array.isArray(cfg.SDKS) && cfg.SDKS.length) msg += ` SDKs declarados: ${cfg.SDKS.map((s) => s && s.nombre).filter(Boolean).join(", ")} (node kit.js sdk list; flujo end-to-end: /pipeline --sdk <nombre> "idea").`;
    if (cfg._source === "ps1") msg += " AVISO: pipeline.config.ps1 es el formato antiguo; ejecuta 'node kit.js migrate'.";
    const m = C.readJson(path.join(root, ".github", "kit-manifest.json"), null) || C.readJson(path.join(root, ".pipeline", "kit-manifest.json"), null);
    if (m && m.version && m.version !== C.VERSION) msg += ` AVISO: los archivos del proyecto son de la versión ${m.version}; ejecuta 'node kit.js update'.`;
    if (!fs.existsSync(path.join(root, "kit.js"))) msg += " AVISO: falta kit.js (proyecto de una versión anterior); ejecuta la inicialización del kit.";
  }
  if (C.FLAVOR === "copilot") process.stdout.write(JSON.stringify({ additionalContext: msg }) + "\n");
  else process.stdout.write(msg + "\n");
}

function main() {
  const name = process.argv[2];
  const evt = readEvent();
  const a = normalize(evt);
  const root = C.findProjectRoot(a.cwd);
  if (name === "session-start") return sessionStart(root);
  if (!root) return; // proyectos sin kit: no interferir
  const cfg = C.loadConfig(root);
  if (name === "protect-main") return protectMain(a, root, cfg);
  if (name === "commit-gate") return commitGate(a, root, cfg);
  process.stderr.write(`hook desconocido: ${name}\n`);
}
try { main(); } catch (e) { process.stderr.write(`kit hook ${process.argv[2]}: ${e.message}\n`); process.exit(0); }
