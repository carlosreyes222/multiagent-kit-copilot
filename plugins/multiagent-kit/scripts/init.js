// Inicializa (o actualiza) un proyecto para usar el kit. Uso: node kit.js init|update [--modo repo|local|usuario] | migrate
// Modos:
//   repo    (por defecto) todo se copia al proyecto y se versiona (equipo y cloud agent lo ven).
//   local   igual que repo, pero cada archivo del kit se añade a .git/info/exclude: queda en tu carpeta, invisible para git.
//   usuario nada del kit va al repositorio: agentes, skills, prompts y hooks se instalan en tu perfil
//           (~/.copilot/{agents,skills,hooks} y la carpeta de prompts de usuario de VS Code) y valen para todos los
//           proyectos; en el proyecto solo quedan pipeline.config.json, kit.js, AGENTS.md/CLAUDE.md, .pipeline/ y las
//           plantillas de docs/, excluidos de git. El cloud agent de github.com no ve los agentes en este modo.
// Dos tipos de archivo:
//   - TUYOS (pipeline.config.json, CLAUDE.md/AGENTS.md, staging/, docs/, settings…): se crean si faltan y NUNCA se
//     sobrescriben (si hay versión nueva del kit queda al lado con sufijo .kit; .gitignore/.dockerignore se fusionan).
//   - GESTIONADOS por el kit (kit.js y, en Copilot, agentes, skills, prompts, hooks, instructions): se copian del
//     plugin y se refrescan con `update` mientras no los hayas modificado (hash guardado en el manifiesto).
// `migrate` convierte un pipeline.config.ps1 antiguo en pipeline.config.json.
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./common");
const U = require("./user-install");

const MODES = ["repo", "local", "usuario"];

module.exports = async function init(opts, { mode }) {
  const dest = path.resolve(opts.destino || process.env.KIT_PROJECT_DIR || process.cwd());
  const tpl = path.join(C.PLUGIN_ROOT, "templates");
  const isCopilot = C.FLAVOR === "copilot";
  if (mode === "migrate") return migrate(dest);

  // Modo: --modo X, alias --usuario/--local, o el guardado en .pipeline/kit.json (para update)
  const kitJsonPath = path.join(dest, ".pipeline", "kit.json");
  const prevKit = C.readJson(kitJsonPath, {});
  let kitMode = opts.modo || opts.mode || (opts.usuario || opts.user ? "usuario" : opts.local ? "local" : null) || prevKit.mode || "repo";
  if (!MODES.includes(kitMode)) { C.log.fail(`Modo desconocido: ${kitMode} (repo | local | usuario)`); return 1; }
  const excludeFromGit = kitMode !== "repo";
  const copyGithub = isCopilot && kitMode !== "usuario";
  const manifestPath = copyGithub ? path.join(dest, ".github", "kit-manifest.json") : path.join(dest, ".pipeline", "kit-manifest.json");

  if (!fs.existsSync(path.join(dest, ".git"))) C.log.yellow(`AVISO: '${dest}' no es un repositorio git. Los hooks de ramas protegidas necesitan git.`);
  C.log.cyan(`${mode === "update" ? "Actualizando" : "Inicializando"} kit multiagente (${C.FLAVOR}) v${C.VERSION} en ${dest} — modo ${kitMode}`);

  const creados = [], conservados = [], fusionados = [], actualizados = [], modificados = [], excluidos = [], retirados = [];
  // Cambio a modo usuario desde repo/local: retira de .github/ lo que el kit copió antes (solo si sigue idéntico a lo copiado)
  const oldGithubManifest = path.join(dest, ".github", "kit-manifest.json");
  if (kitMode === "usuario" && isCopilot && fs.existsSync(oldGithubManifest)) {
    const old = C.readJson(oldGithubManifest, { files: {}, templates: {} });
    const rmIfSame = (rel, hash) => {
      const f = path.join(dest, rel);
      if (!rel.startsWith(".github/") || !fs.existsSync(f)) return;
      if (C.sha256(f) !== hash) { modificados.push(`${rel}  (lo modificaste; no lo retiro al cambiar a modo usuario)`); return; }
      fs.unlinkSync(f); retirados.push(rel);
      let d = path.dirname(f);
      while (d.startsWith(path.join(dest, ".github")) && fs.existsSync(d) && fs.readdirSync(d).length === 0) { fs.rmdirSync(d); d = path.dirname(d); }
    };
    for (const [rel, hash] of Object.entries(old.files || {})) rmIfSame(rel, hash);
    for (const [rel, hash] of Object.entries(old.templates || {})) rmIfSame(rel, hash);
    for (const rel of [".github/copilot-instructions.md", ".github/copilot/settings.json", ".github/workflows/copilot-setup-steps.yml"]) {
      const t = path.join(tpl, "github", rel.replace(/^\.github\//, ""));
      if (fs.existsSync(t) && !(old.templates || {})[rel]) rmIfSame(rel, C.sha256(t));
    }
    for (const rel of [".gitignore", ".dockerignore"]) { // solo si los creó el kit y nadie los tocó
      const f = path.join(dest, rel), t = path.join(tpl, rel);
      if (fs.existsSync(f) && fs.existsSync(t) && C.sha256(f) === C.sha256(t)) { fs.unlinkSync(f); retirados.push(rel); }
    }
    fs.unlinkSync(oldGithubManifest); retirados.push(".github/kit-manifest.json");
    const gh = path.join(dest, ".github"); if (fs.existsSync(gh) && fs.readdirSync(gh).length === 0) fs.rmdirSync(gh);
  }
  const manifest = C.readJson(manifestPath, { version: "", files: {}, templates: {} });
  if (!manifest.files) manifest.files = {};
  if (!manifest.templates) manifest.templates = {};
  const excludeList = new Set();

  const copySafe = (rel, destRel = rel) => {
    const src = path.join(tpl, rel), dst = path.join(dest, destRel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    excludeList.add(destRel);
    const key = destRel.replace(/\\/g, "/"), srcHash = C.sha256(src);
    if (fs.existsSync(dst)) {
      // Archivo tuyo: solo dejamos una copia .kit si la plantilla cambió desde la última vez que la viste
      if (srcHash !== C.sha256(dst) && manifest.templates[key] !== srcHash) {
        fs.copyFileSync(src, dst + ".kit");
        excludeList.add(destRel + ".kit");
        conservados.push(`${destRel}  (nueva versión en ${destRel}.kit)`);
      }
    } else { fs.copyFileSync(src, dst); creados.push(destRel); }
    manifest.templates[key] = srcHash;
  };
  const mergeLines = (rel) => {
    const src = path.join(tpl, rel), dst = path.join(dest, rel);
    if (excludeFromGit && !fs.existsSync(dst)) return; // en modo local/usuario no creamos .gitignore/.dockerignore nuevos
    if (!fs.existsSync(dst)) { fs.copyFileSync(src, dst); creados.push(rel); return; }
    if (excludeFromGit && rel === ".gitignore") return; // no tocar el .gitignore del equipo
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
    excludeList.add(key);
    const srcHash = C.sha256(srcAbs);
    if (!fs.existsSync(dst)) { fs.copyFileSync(srcAbs, dst); creados.push(destRel); manifest.files[key] = srcHash; return; }
    const cur = C.sha256(dst);
    if (cur === srcHash) { manifest.files[key] = srcHash; return; }
    if (manifest.files[key] && cur === manifest.files[key]) { fs.copyFileSync(srcAbs, dst); actualizados.push(destRel); manifest.files[key] = srcHash; }
    else { fs.copyFileSync(srcAbs, dst + ".kit"); excludeList.add(key + ".kit"); modificados.push(`${destRel}  (lo modificaste; la versión nueva está en ${destRel}.kit)`); }
  };

  // --- Archivos tuyos ---
  if (fs.existsSync(path.join(dest, "pipeline.config.ps1")) && !fs.existsSync(path.join(dest, "pipeline.config.json"))) {
    C.log.yellow("Encontrado pipeline.config.ps1 (formato antiguo): lo convierto a pipeline.config.json.");
    migrate(dest, true);
    excludeList.add("pipeline.config.json"); excludeList.add("pipeline.config.ps1.migrado");
  } else copySafe("pipeline.config.json");
  copySafe(C.CONTEXT_FILE);
  if (isCopilot && copyGithub) {
    copySafe("github/copilot-instructions.md", ".github/copilot-instructions.md");
    copySafe("github/copilot/settings.json", ".github/copilot/settings.json");
    copySafe("github/workflows/copilot-setup-steps.yml", ".github/workflows/copilot-setup-steps.yml");
  } else if (!isCopilot) {
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
  if (copyGithub) {
    installManaged(path.join(tpl, "github/hooks/kit.json"), ".github/hooks/kit.json");
    installManaged(path.join(tpl, "github/instructions/kit.instructions.md"), ".github/instructions/kit.instructions.md");
    for (const f of fs.readdirSync(path.join(C.PLUGIN_ROOT, "com.github.copilot/agents"))) if (f.endsWith(".agent.md")) installManaged(path.join(C.PLUGIN_ROOT, "com.github.copilot/agents", f), `.github/agents/${f}`);
    for (const d of fs.readdirSync(path.join(C.PLUGIN_ROOT, "skills"))) {
      const sk = path.join(C.PLUGIN_ROOT, "skills", d, "SKILL.md");
      if (fs.existsSync(sk)) installManaged(sk, `.github/skills/${d}/SKILL.md`);
    }
    for (const f of fs.readdirSync(path.join(tpl, "github/prompts"))) if (f.endsWith(".prompt.md")) installManaged(path.join(tpl, "github/prompts", f), `.github/prompts/${f}`);
    excludeList.add(".github/kit-manifest.json");
  }

  // --- Instalación a nivel de usuario (modo usuario) ---
  let userResult = null;
  if (kitMode === "usuario" && isCopilot) userResult = U.installUser({ update: mode === "update" });

  // Manifiesto y registro local
  const files = {};
  for (const k of Object.keys(manifest.files).sort()) files[k] = manifest.files[k];
  const templates = {};
  for (const k of Object.keys(manifest.templates).sort()) templates[k] = manifest.templates[k];
  C.writeJson(manifestPath, { version: C.VERSION, mode: kitMode, updatedAt: C.nowIso(), files, templates });
  C.writeJson(kitJsonPath, { pluginRoot: C.PLUGIN_ROOT, version: C.VERSION, projectFilesVersion: C.VERSION, mode: kitMode, initializedAt: prevKit.initializedAt || C.nowIso(), updatedAt: C.nowIso() });
  excludeList.add(".pipeline/");

  // --- .git/info/exclude (modo local y usuario) ---
  if (excludeFromGit) {
    const gitDir = path.join(dest, ".git");
    if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
      const exPath = path.join(gitDir, "info", "exclude");
      fs.mkdirSync(path.dirname(exPath), { recursive: true });
      const existing = fs.existsSync(exPath) ? fs.readFileSync(exPath, "utf8").split(/\r?\n/) : [];
      const toAdd = [...excludeList].map((p) => "/" + p.replace(/\\/g, "/")).filter((p) => !existing.includes(p));
      if (toAdd.length) {
        fs.appendFileSync(exPath, `\n# --- multiagent-kit (modo ${kitMode}): archivos del kit solo en este clon ---\n${toAdd.join("\n")}\n`);
        excluidos.push(...toAdd);
      }
    } else C.log.warn("No hay .git en el proyecto: no se pudo escribir .git/info/exclude.");
  }

  const show = (title, list, color, mark) => { if (list.length) { C.log[color]("\n" + title); list.forEach((x) => console.log(`  ${mark} ${x}`)); } };
  show("Creados:", creados, "green", "+");
  show("Retirados del proyecto (ahora viven en tu perfil de usuario):", retirados, "cyan", "x");
  show("Actualizados (gestionados por el kit):", actualizados, "green", "^");
  show("Fusionados:", fusionados, "green", "~");
  show("Ya existían (NO se tocaron; revisa el .kit y fusiona a mano):", conservados, "yellow", "=");
  show("Gestionados por el kit pero modificados por ti (NO se tocaron):", modificados, "yellow", "!");
  show("Excluidos de git en este clon (.git/info/exclude):", excluidos, "cyan", "-");
  if (userResult) {
    show("Instalados en tu perfil de usuario:", userResult.creados.concat(userResult.actualizados), "green", "*");
    show("En tu perfil, modificados por ti (NO se tocaron):", userResult.modificados, "yellow", "!");
    if (userResult.avisos.length) userResult.avisos.forEach((a) => C.log.warn(a));
  }
  if (![creados, actualizados, fusionados, conservados, modificados, excluidos, retirados].some((l) => l.length) && !(userResult && (userResult.creados.length || userResult.actualizados.length))) C.log.green(`\nTodo al día (v${C.VERSION}).`);

  if (mode !== "update") {
    C.log.cyan("\nSiguiente:");
    console.log("  1. Edita pipeline.config.json (build/test/lint, proveedor de staging)");
    console.log(`  2. Edita ${C.CONTEXT_FILE} con la descripción de tu proyecto`);
    console.log("  3. node kit.js check      (verifica herramientas)");
    console.log(`  4. ${isCopilot ? "copilot  ->  /pipeline \"tu idea\"     (o en VS Code: /pipeline)" : "claude  ->  /pipeline \"tu idea\""}`);
    if (kitMode === "repo" && isCopilot) console.log("  5. Haz commit de .github/ y kit.js para que el equipo y el cloud agent usen lo mismo");
    if (kitMode === "usuario") console.log("  5. Reinicia VS Code / la sesión de copilot para que cargue los agentes del perfil de usuario. Nada del kit aparece en git status.");
    if (kitMode === "local") console.log("  5. Nada del kit aparece en git status (está en .git/info/exclude). Para versionarlo más adelante: node kit.js init --modo repo y borra las líneas de exclude.");
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
