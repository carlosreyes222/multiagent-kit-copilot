// Entrega de una feature (kit de Copilot): sube la rama y abre el pull request. El flujo termina aquí; el merge, el tren
// de release y el despliegue son del equipo. Uso:
//   kit pr --feature <slug> --base <rama>              -> comprueba compuertas, push de la rama actual y PR con gh (si está)
//   kit pr --feature <slug> --base <rama> --sin-push   -> solo comprueba y escribe la descripción del PR
// Resultado (última línea): PR: CREADO <url> · PR: RAMA SUBIDA (<motivo>) · PR: RAMA LOCAL (<motivo>)
// Código de salida: 0 = PR creado (o --sin-push) · 2 = entrega parcial (rama subida o local, con el motivo) · 1 = bloqueado.
// git y gh se invocan sin shell: títulos, ramas y rutas nunca se interpretan como comandos.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const C = require("./common");

function exec(bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: "utf8", windowsHide: true });
  if (r.error) return { code: r.error.code === "ENOENT" ? 127 : 1, out: r.error.message, missing: r.error.code === "ENOENT" };
  return { code: r.status == null ? 1 : r.status, out: (r.stdout || "") + (r.stderr || ""), stdout: r.stdout || "" };
}
const git = (root, args) => exec("git", args, root);
const gh = (root, args) => exec(process.env.KIT_GH_BIN || "gh", args, root);
const refExists = (root, ref) => git(root, ["rev-parse", "--verify", "--quiet", ref + "^{commit}"]).code === 0;

module.exports = async function pr(opts) {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  const s = C.getState(root);
  const feature = typeof opts.feature === "string" ? opts.feature : s.feature;
  if (!feature) { C.log.fail("Indica la feature: kit pr --feature <slug> --base <rama>"); return 1; }
  const badSlug = C.stateValueError("feature", feature);
  if (badSlug) { C.log.fail(`Slug de feature no válido '${feature}': ${badSlug}`); return 1; }
  const base = typeof opts.base === "string" ? opts.base : s.pr_base || "";
  if (!base) { C.log.fail("Indica la rama base del PR: --base develop (el orquestador la pregunta al iniciar el pipeline)"); return 1; }
  const badBase = C.stateValueError("pr_base", base);
  if (badBase || base.startsWith("-")) { C.log.fail(`Rama base no válida '${base}': ${badBase || "no puede empezar por -"}`); return 1; }
  const branch = C.currentBranch(root);
  if (!branch || C.protectedMatcher(cfg.PROTECTED_BRANCHES)(branch)) { C.log.fail(`Estás en '${branch || "(sin rama)"}'. El PR se abre desde la rama feature/* o fix/* de la feature.`); return 1; }
  if (branch === base) { C.log.fail(`La rama actual es la propia base ('${base}').`); return 1; }

  // 1. Rama base: se actualiza desde origin para comparar contra lo que verá el PR
  C.log.step(`Rama base: ${base}`);
  const fetch = git(root, ["fetch", "--quiet", "origin", base]);
  if (fetch.code !== 0) C.log.warn(`no pude actualizar origin/${base} (${lastLine(fetch.out)}); comparo con lo que haya en local`);
  const baseRef = refExists(root, `refs/remotes/origin/${base}`) ? `origin/${base}` : refExists(root, `refs/heads/${base}`) ? base : null;
  if (!baseRef) { C.log.fail(`La rama base '${base}' no existe ni en origin ni en local. Revisa el nombre (kit state pr_base=<rama>).`); return 1; }
  const behind = parseInt(git(root, ["rev-list", "--count", `HEAD..${baseRef}`]).out.trim(), 10) || 0;
  if (behind > 0) {
    C.log.warn(`la rama va ${behind} commit(s) por detrás de ${baseRef}; conviene integrarla antes del PR (git merge ${baseRef})`);
    const mt = git(root, ["merge-tree", "--write-tree", "--name-only", "HEAD", baseRef]); // git >= 2.38
    if (mt.code === 1) C.log.warn(`y habrá CONFLICTOS al integrar ${baseRef}:\n${mt.out.trim().split(/\r?\n/).slice(1, 9).map((l) => "      " + l).join("\n")}`);
  } else C.log.ok(`al día con ${baseRef}`);

  // 2. Compuertas: informes aprobados, commiteados y del código actual
  C.log.step(`Compuertas de ${feature}`);
  const bloqueos = [], avisos = [];
  const rep = (k) => path.join(root, "docs", "reviews", `${feature}-${k}.md`);
  const check = (k, key, label) => {
    const f = rep(k), rel = `docs/reviews/${feature}-${k}.md`;
    if (!fs.existsSync(f)) { bloqueos.push(`falta ${rel}`); return; }
    const v = C.reportVerdict(f, key);
    if (v === "CONTRADICTORIO") bloqueos.push(`${rel} tiene veredictos contradictorios (APROBADO y RECHAZADO): deja una sola línea de veredicto`);
    else if (v !== "APROBADO") bloqueos.push(`${label} no está APROBADO en ${rel} (${v})`);
    if (git(root, ["status", "--porcelain", "--", rel]).out.trim()) bloqueos.push(`${rel} tiene cambios sin commit`);
    const sha = C.reportCommit(f);
    if (!sha) { avisos.push(`${rel} no indica 'COMMIT: <sha>' del código revisado; no puedo comprobar que la revisión sea de la versión actual`); return; }
    if (!refExists(root, sha)) { bloqueos.push(`${rel} dice COMMIT: ${sha}, que no existe en este repositorio`); return; }
    const changed = git(root, ["diff", "--name-only", `${sha}..HEAD`]).out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("docs/"));
    if (changed.length) bloqueos.push(`${label} revisó ${sha}, pero después cambió código (${changed.slice(0, 5).join(", ")}${changed.length > 5 ? "…" : ""}): repite ${label}`);
  };
  check("qa", "QA", "QA");
  if (s.compuertas !== "reducidas") check("codigo", "C[OÓ]DIGO", "la revisión de código");
  check("seguridad", "VEREDICTO", "la revisión de seguridad");
  const dirty = git(root, ["status", "--porcelain"]).out.split(/\r?\n/).filter((l) => l.trim() && !l.endsWith(`docs/reviews/${feature}-pr.md`));
  if (dirty.length) bloqueos.push(`hay cambios sin commit en la rama:\n${dirty.slice(0, 8).map((l) => "      " + l).join("\n")}`);
  avisos.forEach((a) => C.log.warn(a));
  if (bloqueos.length) { C.log.red("PR BLOQUEADO:"); bloqueos.forEach((b) => C.log.fail(b)); return 1; }
  C.log.ok("QA, seguridad" + (s.compuertas !== "reducidas" ? " y revisión de código" : "") + " aprobados y commiteados; rama limpia");

  const ticket = String(s.ticket || "").toUpperCase();
  const spec = path.join(root, "docs", "specs", `${feature}.md`);
  const title = (() => {
    let t = feature.replace(/^([A-Z][A-Z0-9]+-\d+)-/, "").replace(/-/g, " ");
    if (fs.existsSync(spec)) { const m = /^#\s+(?:Spec:\s*)?(.+)$/m.exec(fs.readFileSync(spec, "utf8")); if (m) t = m[1].trim(); }
    const tipo = s.type === "bugfix" ? "fix" : "feat";
    return `${tipo}: ${ticket && !t.includes(ticket) ? ticket + " " : ""}${t}`.replace(/[\r\n]+/g, " ").slice(0, 120);
  })();

  // 3. Descripción del PR
  const rel = (p) => path.relative(root, p).replace(/\\/g, "/");
  const docs = [["Spec", spec], ["ADR", path.join(root, "docs", "adr", `${feature}.md`)], ["QA", rep("qa")], ["Revisión de código", rep("codigo")], ["Seguridad", rep("seguridad")]].filter(([, p]) => fs.existsSync(p));
  const log = git(root, ["log", "--oneline", `${baseRef}..HEAD`]).out.trim();
  const body = [
    `## ${title}`, "",
    ticket ? `Ticket: ${ticket}` : "", `Rama: \`${branch}\` → \`${base}\``, `Compuertas: QA APROBADO · Seguridad APROBADO${s.compuertas === "reducidas" ? " · modo rápido (sin revisión de código)" : " · Revisión de código APROBADO"}`, "",
    "### Documentos", ...docs.map(([n, p]) => `- ${n}: \`${rel(p)}\``), "",
    "### Commits", "```", log || "(sin commits propios respecto a la base)", "```", "",
    "### Cómo probar", fs.existsSync(rep("qa")) ? "Ver la sección de pruebas de `" + rel(rep("qa")) + "`." : "(ver informe de QA)", "",
    "Generado por multiagent-kit.",
  ].filter((l) => l !== "").join("\n") + "\n";
  // La descripción se versiona (va en la rama); el estado del PR es local de esta máquina (.pipeline/pr/<slug>.json)
  const prDoc = rep("pr");
  fs.mkdirSync(path.dirname(prDoc), { recursive: true });
  const docTxt = `# PR — ${feature}\n\nTítulo: ${title}\nBase: ${base}\nFecha: ${C.nowIso()}\n\n---\n\n${body}`;
  if (!fs.existsSync(prDoc) || fs.readFileSync(prDoc, "utf8").split("\n").slice(6).join("\n") !== docTxt.split("\n").slice(6).join("\n")) {
    fs.writeFileSync(prDoc, docTxt, "utf8");
    git(root, ["add", "--", rel(prDoc)]);
    const cm = git(root, ["commit", "-m", `docs: ${ticket ? ticket + " " : ""}descripción del PR de ${feature}`, "--", rel(prDoc)]);
    if (cm.code === 0) C.log.ok(`docs/reviews/${feature}-pr.md commiteado`);
    else C.log.warn(`no pude commitear docs/reviews/${feature}-pr.md (${lastLine(cm.out)})`);
  }
  const finish = (estado, detalle, url, code) => {
    const line = estado === "CREADO" ? `PR: CREADO ${url}` : `PR: ${estado} (${detalle})`;
    C.writeJson(path.join(root, ".pipeline", "pr", `${feature}.json`), { feature, branch, base, estado, detalle: detalle || "", url: url || "", title, at: C.nowIso() });
    C.setState(root, { pr_base: base, pr_estado: estado.toLowerCase().replace(" ", "_"), pr_url: url || "", stage: "entrega" });
    (code === 0 ? C.log.green : C.log.yellow)("\n" + line);
    return code;
  };
  if (opts["sin-push"]) return finish("RAMA LOCAL", "sin push por petición (--sin-push); descripción en docs/reviews/" + feature + "-pr.md", "", 0);

  // 4. Push
  C.log.step(`git push -u origin ${branch}`);
  const push = git(root, ["push", "-u", "origin", branch]);
  if (push.code !== 0) {
    const lines = push.out.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const motivo = lines.find((l) => /fatal|error|rejected|denied|not found|could not/i.test(l)) || lines.pop() || "sin detalle";
    C.log.fail(motivo); return finish("RAMA LOCAL", `push falló: ${motivo}`, "", 2);
  }
  C.log.ok("rama subida");

  // 5. PR con gh (opcional)
  const ver = gh(root, ["--version"]);
  if (ver.missing || ver.code !== 0) return finish("RAMA SUBIDA", "gh CLI no instalado: abre el PR en GitHub con la descripción de docs/reviews/" + feature + "-pr.md", "", 2);
  const open = gh(root, ["pr", "list", "--head", branch, "--state", "open", "--json", "url,baseRefName"]);
  if (open.code === 0) {
    let list = []; try { list = JSON.parse(open.stdout || "[]"); } catch { /* salida inesperada */ }
    if (list.length) {
      if (list[0].baseRefName && list[0].baseRefName !== base) C.log.warn(`el PR abierto apunta a '${list[0].baseRefName}', no a '${base}'; cámbialo en GitHub si hace falta`);
      C.log.ok("ya había un PR abierto para esta rama (la rama nueva ya está subida)");
      return finish("CREADO", "", list[0].url, 0);
    }
  }
  const bodyFile = path.join(root, ".pipeline", `pr-body-${feature}.md`);
  fs.writeFileSync(bodyFile, body, "utf8");
  C.log.step(`gh pr create --base ${base}`);
  const r = gh(root, ["pr", "create", "--base", base, "--head", branch, "--title", title, "--body-file", bodyFile]);
  const url = (r.out.match(/https?:\/\/\S+\/pull\/\d+/) || r.out.match(/https?:\/\/\S+/) || [])[0];
  if (r.code === 0 && url) { C.log.ok(url); return finish("CREADO", "", url, 0); }
  return finish("RAMA SUBIDA", `gh pr create falló: ${lastLine(r.out)}; abre el PR a mano con docs/reviews/${feature}-pr.md`, "", 2);
};

function lastLine(out) { return String(out || "").trim().split(/\r?\n/).pop() || "sin detalle"; }
