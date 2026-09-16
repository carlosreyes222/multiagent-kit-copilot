// Inicializa (o actualiza) un proyecto para usar el kit. Uso: node kit.js init | update | migrate
// Dos tipos de archivo:
//   - TUYOS (pipeline.config.json, CLAUDE.md/AGENTS.md, staging/, docs/, settings…): se crean si faltan y NUNCA se
//     sobrescriben (si hay versión nueva del kit queda al lado con sufijo .kit; .gitignore/.dockerignore se fusionan).
//   - GESTIONADOS por el kit (kit.js y, en Copilot, .github/agents, skills, prompts, hooks, instructions): se copian del
//     plugin y se refrescan con `update` mientras no los hayas modificado (hash guardado en el manifiesto).
// `migrate` convierte un pipeline.config.ps1 antiguo en pipeline.config.json.
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./common");

module.exports = async function init(opts, { mode }) {
  const dest = path.resolve(opts.destino || process.env.KIT_PROJECT_DIR || process.cwd());
  const tpl = path.join(C.PLUGIN_ROOT, "templates");
  const isCopilot = C.FLAVOR === "copilot";
  const manifestPath = isCopilot ? path.join(dest, ".github", "kit-manifest.json") : path.join(dest, ".pipeline", "kit-manifest.json");

  if (mode === "migrate") return migrate(dest);
  if (!fs.existsSync(path.join(dest, ".git"))) C.log.yellow(`AVISO: '${dest}' no es un repositorio git. Los hooks de ramas protegidas necesitan git.`);
  C.log.cyan(`${mode === "update" ? "Actualizando" : "Inicializando"} kit multiagente (${C.FLAVOR}) v${C.VERSION} en ${dest}`);

  const creados = [], conservados = [], fusionados = [], actualizados = [], modificados = [];
  const manifest = C.readJson(manifestPath, { version: "", files: {} });
  if (!manifest.files) manifest.files = {};

  const copySafe = (rel, destRel = rel) => {
    const src = path.join(tpl, rel), dst = path.join(dest, destRel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (fs.existsSync(dst)) {
      if (C.sha256(src) === C.sha256(dst)) return;
      fs.copyFileSync(src, dst + ".kit");
      conservados.push(`${destRel}  (nueva versión en ${destRel}.kit)`);
    } else { fs.copyFileSync(src, dst); creados.push(destRel); }
  };
  const mergeLines = (rel) => {
    const src = path.join(tpl, rel), dst = path.join(dest, rel);
    if (!fs.existsSync(dst)) { fs.copyFileSync(src, dst); creados.push(rel); return; }
    const existing = fs.readFileSync(dst, "utf8").split(/\r?\n/);
    const missing = fs.readFileSync(src, "utf8").split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l) && !existing.includes(l));
    if (missing.length) {
      fs.appendFileSync(dst, `\n# --- añadido por multiagent-kit ---\n${missing.join("\n")}\n`);
      fusionados.push(`${rel}  (+${missing.length} líneas)`);
    }
  };
  const installManaged = (srcAbs, destRel) => {
    const dst = path.join(dest, destRel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const key = destRel.replace(/\\/g, "/");
    const srcHash = C.sha256(srcAbs);
    if (!fs.existsSync(dst)) { fs.copyFileSync(srcAbs, dst); creados.push(destRel); manifest.files[key] = srcHash; return; }
    const cur = C.sha256(dst);
    if (cur === srcHash) { manifest.files[key] = srcHash; return; }
    if (manifest.files[key] && cur === manifest.files[key]) { fs.copyFileSync(srcAbs, dst); actualizados.push(destRel); manifest.files[key] = srcHash; }
    else { fs.copyFileSync(srcAbs, dst + ".kit"); modificados.push(`${destRel}  (lo modificaste; la versión nueva está en ${destRel}.kit)`); }
  };

  // --- Archivos tuyos ---
  if (fs.existsSync(path.join(dest, "pipeline.config.ps1")) && !fs.existsSync(path.join(dest, "pipeline.config.json"))) {
    C.log.yellow("Encontrado pipeline.config.ps1 (formato antiguo): lo convierto a pipeline.config.json.");
    migrate(dest, true);
  } else copySafe("pipeline.config.json");
  copySafe(C.CONTEXT_FILE);
  if (isCopilot) {
    copySafe("github/copilot-instructions.md", ".github/copilot-instructions.md");
    copySafe("github/copilot/settings.json", ".github/copilot/settings.json");
    copySafe("github/workflows/copilot-setup-steps.yml", ".github/workflows/copilot-setup-steps.yml");
  } else {
    copySafe("claude/settings.json", ".claude/settings.json");
  }
  copySafe("staging/docker-compose.staging.yml");
  copySafe("staging/Dockerfile.staging");
  copySafe("staging/env.staging.example", "staging/.env.staging");
  copySafe("docs/_PLANTILLA-ARQUITECTURA.md");
  copySafe("docs/specs/_PLANTILLA.md");
  copySafe("docs/adr/_PLANTILLA.md");
  copySafe("docs/reviews/_PLANTILLA-seguridad.md");
  mergeLines(".gitignore");
  mergeLines(".dockerignore");
  if (!isCopilot && fs.existsSync(path.join(tpl, ".worktreeinclude"))) mergeLines(".worktreeinclude");

  // --- Archivos gestionados por el kit ---
  installManaged(path.join(tpl, "kit.js"), "kit.js");
  if (isCopilot) {
    installManaged(path.join(tpl, "github/hooks/kit.json"), ".github/hooks/kit.json");
    installManaged(path.join(tpl, "github/instructions/kit.instructions.md"), ".github/instructions/kit.instructions.md");
    for (const f of fs.readdirSync(path.join(C.PLUGIN_ROOT, "com.github.copilot/agents"))) if (f.endsWith(".agent.md")) installManaged(path.join(C.PLUGIN_ROOT, "com.github.copilot/agents", f), `.github/agents/${f}`);
    for (const d of fs.readdirSync(path.join(C.PLUGIN_ROOT, "skills"))) {
      const sk = path.join(C.PLUGIN_ROOT, "skills", d, "SKILL.md");
      if (fs.existsSync(sk)) installManaged(sk, `.github/skills/${d}/SKILL.md`);
    }
    for (const f of fs.readdirSync(path.join(tpl, "github/prompts"))) if (f.endsWith(".prompt.md")) installManaged(path.join(tpl, "github/prompts", f), `.github/prompts/${f}`);
  }

  // Manifiesto y registro local
  const files = {};
  for (const k of Object.keys(manifest.files).sort()) files[k] = manifest.files[k];
  C.writeJson(manifestPath, { version: C.VERSION, updatedAt: C.nowIso(), files });
  C.writeJson(path.join(dest, ".pipeline", "kit.json"), { pluginRoot: C.PLUGIN_ROOT, version: C.VERSION, projectFilesVersion: C.VERSION, initializedAt: C.nowIso() });

  const show = (title, list, color, mark) => { if (list.length) { C.log[color]("\n" + title); list.forEach((x) => console.log(`  ${mark} ${x}`)); } };
  show("Creados:", creados, "green", "+");
  show("Actualizados (gestionados por el kit):", actualizados, "green", "^");
  show("Fusionados:", fusionados, "green", "~");
  show("Ya existían (NO se tocaron; revisa el .kit y fusiona a mano):", conservados, "yellow", "=");
  show("Gestionados por el kit pero modificados por ti (NO se tocaron):", modificados, "yellow", "!");
  if (![creados, actualizados, fusionados, conservados, modificados].some((l) => l.length)) C.log.green(`\nTodo al día (v${C.VERSION}).`);

  if (mode !== "update") {
    C.log.cyan("\nSiguiente:");
    console.log("  1. Edita pipeline.config.json (build/test/lint, proveedor de staging)");
    console.log(`  2. Edita ${C.CONTEXT_FILE} con la descripción de tu proyecto`);
    console.log("  3. node kit.js check      (verifica herramientas)");
    console.log(`  4. ${isCopilot ? "copilot  ->  /pipeline \"tu idea\"     (o en VS Code: /pipeline)" : "claude  ->  /pipeline \"tu idea\""}`);
    if (isCopilot) console.log("  5. Haz commit de .github/ y kit.js para que el equipo y el cloud agent usen lo mismo");
  }
  return 0;
};

// pipeline.config.ps1 -> pipeline.config.json (conserva el .ps1 con sufijo .migrado)
function migrate(dest, silent) {
  const ps1 = path.join(dest, "pipeline.config.ps1"), json = path.join(dest, "pipeline.config.json");
  if (!fs.existsSync(ps1)) { if (!silent) C.log.warn("No hay pipeline.config.ps1 que migrar."); return 0; }
  if (fs.existsSync(json)) { C.log.warn("Ya existe pipeline.config.json; no se sobrescribe. Borra uno de los dos."); return 1; }
  const data = C.parseLegacyPs1(fs.readFileSync(ps1, "utf8"));
  const tplData = C.readJson(path.join(C.PLUGIN_ROOT, "templates", "pipeline.config.json"), {});
  const out = {};
  if (tplData._comentarios) out._comentarios = tplData._comentarios;
  for (const k of Object.keys(C.DEFAULTS)) out[k] = k in data ? data[k] : C.DEFAULTS[k];
  for (const k of Object.keys(data)) if (!(k in out)) out[k] = data[k];
  C.writeJson(json, out);
  fs.renameSync(ps1, ps1 + ".migrado");
  C.log.ok(`pipeline.config.json creado a partir de pipeline.config.ps1 (guardado como pipeline.config.ps1.migrado). Revisa los valores y bórralo cuando estés conforme.`);
  return 0;
}
