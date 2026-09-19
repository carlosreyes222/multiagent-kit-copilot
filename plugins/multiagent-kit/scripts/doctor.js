// Diagnóstico completo del kit en este PC y este proyecto, con el arreglo de cada cosa. Uso:
//   node kit.js doctor          -> revisa y propone
//   node kit.js doctor --fix    -> aplica los arreglos seguros (permisos, kit.js, .kit idénticos, locks de git antiguos)
// Complementa a `check` (herramientas) : doctor mira el kit en sí — versiones, modo, hooks vivos, permisos, restos.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const C = require("./common");
const R = require("./remote");

module.exports = async function doctor(opts) {
  const fix = !!opts.fix;
  const root = C.findProjectRoot();
  const problems = [], fixed = [];
  const bad = (msg, how) => { problems.push({ msg, how }); C.log.fail(msg); if (how) C.log.plain("    → " + how); };
  const good = (m) => C.log.ok(m);

  // 1. Plugin instalado vs GitHub
  C.log.step(`Plugin ${C.FLAVOR} v${C.VERSION} en ${C.PLUGIN_ROOT}`);
  const u = await R.checkUpdate({ force: true, timeoutMs: 5000 });
  if (!u.remote) C.log.warn(`No pude consultar la versión en GitHub (${u.error}).`);
  else if (R.cmpVer(u.remote, C.VERSION) > 0) bad(`Plugin desactualizado: GitHub tiene ${u.remote}, instalada ${C.VERSION}.`, `${R.updateHint()} y luego node kit.js update`);
  else if (R.cmpVer(u.remote, C.VERSION) < 0) C.log.plain(`Plugin local ${C.VERSION} más nuevo que GitHub (${u.remote}): pendiente de push.`);
  else good(`Plugin al día con GitHub (${u.remote}).`);
  const major = parseInt(process.version.slice(1), 10);
  if (major < 18) bad(`Node ${process.version} (< 18)`, "instala Node LTS"); else good(`Node ${process.version}`);

  if (!root) {
    C.log.warn("No estás en un proyecto inicializado (sin pipeline.config.json): solo se revisó el plugin.");
    return finish();
  }
  const cfg = C.loadConfig(root);
  const isCopilot = C.FLAVOR === "copilot";

  // 2. Archivos del proyecto: versión, modo, exclude
  C.log.step(`Proyecto ${root}`);
  const mfPath = [path.join(root, ".github", "kit-manifest.json"), path.join(root, ".pipeline", "kit-manifest.json")].find((p) => fs.existsSync(p));
  const mf = mfPath ? C.readJson(mfPath, {}) : null;
  const mode = (mf && mf.mode) || "repo";
  if (!mf) bad("Sin manifiesto del kit.", "node kit.js init [--modo repo|local|usuario]");
  else if (mf.version !== C.VERSION) bad(`Archivos del proyecto v${mf.version} ≠ plugin v${C.VERSION}.`, "node kit.js update");
  else good(`Archivos del proyecto v${mf.version} · modo ${mode}`);
  if (cfg._source === "ps1") bad("Config en pipeline.config.ps1 (antiguo).", "node kit.js migrate");
  for (const rest of ["kit.ps1", "pipeline.config.ps1.migrado", "scripts/run-hook.sh"]) if (fs.existsSync(path.join(root, rest))) bad(`Resto de versiones antiguas: ${rest}`, "bórralo");
  // kit.js igual a la plantilla (normalizando CRLF)
  const kitJs = path.join(root, "kit.js"), tplKit = path.join(C.PLUGIN_ROOT, "templates", "kit.js");
  if (!fs.existsSync(kitJs)) bad("Falta kit.js.", "node kit.js init");
  else if (C.sha256(kitJs) !== C.sha256(tplKit)) {
    if (fix) { fs.copyFileSync(tplKit, kitJs); fixed.push("kit.js refrescado"); good("kit.js refrescado desde la plantilla"); }
    else bad("kit.js no coincide con la plantilla del plugin.", "node kit.js update (o doctor --fix)");
  } else good("kit.js al día");
  if (mode !== "repo") {
    const ex = path.join(root, ".git", "info", "exclude");
    if (fs.existsSync(ex) && /multiagent-kit/.test(fs.readFileSync(ex, "utf8"))) good(".git/info/exclude con el bloque del kit");
    else bad(`Modo ${mode} pero .git/info/exclude no tiene el bloque del kit.`, "node kit.js update");
    // archivos del kit que siguen en el repo en modo usuario
    if (mode === "usuario" && isCopilot) {
      const leftovers = [".github/agents/director.agent.md", ".github/skills/pipeline/SKILL.md", ".github/hooks/kit.json"].filter((f) => fs.existsSync(path.join(root, f)));
      if (leftovers.length) bad(`Modo usuario pero quedan archivos del kit en el repo: ${leftovers.join(", ")}`, "node kit.js init --modo usuario (los retira si no los editaste)");
    }
  }
  // git tracked kit files in non-repo modes
  if (mode !== "repo" && fs.existsSync(path.join(root, ".git"))) {
    const t = spawnSync("git", ["-C", root, "ls-files", "--error-unmatch", "kit.js", "pipeline.config.json"], { encoding: "utf8" });
    if (t.status === 0) bad("kit.js / pipeline.config.json están versionados en git aunque el modo es " + mode + ".", "git rm --cached kit.js pipeline.config.json (quedan en disco, excluidos)");
  }

  // 3. Hooks vivos: se lanza un evento real y se espera que bloquee
  C.log.step("Hooks");
  const hookFile = isCopilot ? (mode === "usuario" ? path.join(require("./user-install").copilotHome(), "hooks", "multiagent-kit.json") : path.join(root, ".github", "hooks", "kit.json")) : path.join(C.PLUGIN_ROOT, "hooks", "hooks.json");
  if (!fs.existsSync(hookFile)) bad(`No existe la definición de hooks: ${hookFile}`, isCopilot ? "node kit.js update" : "reinstala el plugin");
  else good(`Definición de hooks: ${hookFile}`);
  const evt = JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push origin main" }, cwd: root });
  const hr = spawnSync(process.execPath, [path.join(C.PLUGIN_ROOT, "scripts", "hook.js"), "protect-main"], { input: evt, encoding: "utf8", cwd: root, env: Object.assign({}, process.env, { KIT_PROJECT_DIR: root }) });
  if (hr.status === 2) good("protect-main responde (bloqueó un push a main de prueba)");
  else bad(`protect-main no bloqueó un push a main de prueba (exit ${hr.status}). ${(hr.stderr || "").trim().split("\n").pop() || ""}`, "revisa que el proyecto sea un repo git y que PROTECTED_BRANCHES incluya la rama principal");
  if (mode === "usuario" && isCopilot) {
    const launcher = path.join(require("./user-install").copilotHome(), "multiagent-kit-hook.js");
    if (!fs.existsSync(launcher)) bad("Falta el lanzador de hooks de usuario ~/.copilot/multiagent-kit-hook.js", "node kit.js update");
  }

  // 4. Permisos (.claude/settings.json)
  if (!isCopilot) {
    C.log.step(".claude/settings.json");
    const sp = path.join(root, ".claude", "settings.json");
    if (!fs.existsSync(sp)) bad("Falta .claude/settings.json", "node kit.js init");
    else {
      let s; try { s = JSON.parse(fs.readFileSync(sp, "utf8")); } catch { s = null; }
      if (!s) bad(".claude/settings.json no es JSON válido", "corrígelo a mano");
      else {
        const allow = (s.permissions && s.permissions.allow) || [], deny = (s.permissions && s.permissions.deny) || [];
        const needAllow = ["Bash(node kit.js check*)", "Bash(node kit.js staging*)", "Bash(node kit.js smoke*)", "Bash(node kit.js status*)", "Bash(node kit.js state *)", "Bash(node kit.js sdk *)", "Bash(node kit.js update*)"];
        const needDeny = ["Bash(*kit.js prod*)", "Bash(*scripts/prod.js*)"];
        const missA = needAllow.filter((x) => !allow.includes(x)), missD = needDeny.filter((x) => !deny.includes(x));
        if (!missA.length && !missD.length) good("permisos del kit presentes");
        else if (fix) {
          s.permissions = s.permissions || {}; s.permissions.allow = allow.concat(missA); s.permissions.deny = deny.concat(missD);
          fs.writeFileSync(sp, JSON.stringify(s, null, 2) + "\n", "utf8"); fixed.push(`settings.json: +${missA.length} allow, +${missD.length} deny`); good("permisos añadidos");
        } else bad(`Faltan permisos: ${missA.concat(missD).join(", ")}`, "node kit.js doctor --fix");
      }
    }
  }

  // 5. Restos: .kit, locks de git, .pipeline/sdks huérfanos
  C.log.step("Restos");
  const kits = require("./init").listKitCopies(root);
  const identical = kits.filter((k) => fs.existsSync(k.slice(0, -4)) && C.sha256(k) === C.sha256(k.slice(0, -4)));
  const differing = kits.filter((k) => !identical.includes(k));
  if (identical.length) {
    if (fix) { let n = 0; for (const k of identical) { try { fs.unlinkSync(k); n++; } catch { C.log.warn(`No pude borrar ${path.relative(root, k)} (sin permiso)`); } } fixed.push(`${n} .kit idénticos borrados`); good(`${n}/${identical.length} copias .kit idénticas al archivo, borradas`); }
    else bad(`${identical.length} copias .kit idénticas al archivo actual (no aportan nada).`, "node kit.js doctor --fix");
  }
  if (differing.length) C.log.warn(`${differing.length} copias .kit con cambios que no has fusionado: ${differing.map((k) => path.relative(root, k)).join(", ")}  → revísalas y luego node kit.js update --limpiar`);
  if (!kits.length) good("sin copias .kit pendientes");
  const gitDir = path.join(root, ".git");
  if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
    const locks = [];
    const scan = (d, depth) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (depth > 0 && e.name !== "objects") scan(p, depth - 1); } else if (e.name.endsWith(".lock")) locks.push(p); } };
    scan(gitDir, 2);
    for (const l of [path.join(gitDir, "objects", "maintenance.lock")]) if (fs.existsSync(l)) locks.push(l);
    const old = locks.filter((l) => Date.now() - fs.statSync(l).mtimeMs > 10 * 60 * 1000);
    if (old.length) {
      if (fix) { let n = 0; for (const l of old) { try { fs.unlinkSync(l); n++; } catch { /* sin permiso */ } } fixed.push(`${n} locks de git borrados`); good(`${n}/${old.length} locks de git antiguos borrados`); }
      else bad(`Locks de git de más de 10 min (bloquean commits): ${old.map((l) => path.relative(root, l)).join(", ")}`, "node kit.js doctor --fix (o bórralos si no hay ningún git en marcha)");
    } else good("sin locks de git colgados");
  }
  const sdkDir = path.join(root, ".pipeline", "sdks");
  if (fs.existsSync(sdkDir)) {
    const declaredNames = new Set(require("./sdk").declared(cfg).map((s) => s.nombre));
    const orphans = fs.readdirSync(sdkDir).filter((d) => d !== "api" && fs.statSync(path.join(sdkDir, d)).isDirectory() && !declaredNames.has(d));
    if (orphans.length) C.log.warn(`Clones de SDKs que ya no están en SDKS: ${orphans.join(", ")} (.pipeline/sdks/) — bórralos si no los usas`);
  }

  // 6. SDKs
  const S = require("./sdk");
  const sdks = S.declared(cfg);
  if (sdks.length) {
    C.log.step(`SDKs (${sdks.length})`);
    for (const s of sdks) { const errs = S.validate(s); if (errs.length) bad(`${s.nombre || "?"}: ${errs.join("; ")}`, "corrige la entrada en pipeline.config.json → SDKS"); else good(`${s.nombre} (${s.tipo})`); }
  }

  // 7. Lecciones compartidas
  if (fs.existsSync(R.lessonsPath())) good(`Lecciones compartidas: ${R.lessonsPath()}`);
  else C.log.plain(`Sin lecciones compartidas todavía (${R.lessonsPath()}); /retro-kit las crea.`);

  return finish();

  function finish() {
    console.log("");
    if (fixed.length) C.log.green("Arreglado: " + fixed.join("; "));
    if (!problems.length) { C.log.green("Diagnóstico: todo en orden."); return 0; }
    C.log.red(`Diagnóstico: ${problems.length} problema(s).${fix ? "" : " Los marcados con 'doctor --fix' se arreglan solos con: node kit.js doctor --fix"}`);
    return 1;
  }
};
