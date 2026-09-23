// Entrega de una feature (kit de Copilot): sube la rama y abre el pull request. El flujo termina aquí; el merge, el tren
// de release y el despliegue son del equipo. Uso:
//   kit pr --feature <slug> --base <rama>       -> comprueba compuertas, push de la rama actual y PR con gh (si está)
//   kit pr --feature <slug> --base <rama> --sin-push   -> solo comprueba y escribe la descripción del PR
// Resultado (última línea): PR: CREADO <url> · PR: RAMA SUBIDA (<motivo>) · PR: RAMA LOCAL (<motivo>)
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./common");

function git(root, args) { return C.run(`git ${args}`, { cwd: root, quiet: true, ignoreFailure: true }); }

module.exports = async function pr(opts) {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  const s = C.getState(root);
  const feature = typeof opts.feature === "string" ? opts.feature : s.feature;
  if (!feature) { C.log.fail("Indica la feature: kit pr --feature <slug> --base <rama>"); return 1; }
  const base = typeof opts.base === "string" ? opts.base : s.pr_base || "";
  if (!base) { C.log.fail("Indica la rama base del PR: --base develop (el orquestador la pregunta al iniciar el pipeline)"); return 1; }
  const branch = C.currentBranch(root);
  const protectedList = cfg.PROTECTED_BRANCHES || [];
  if (!branch || protectedList.includes(branch)) { C.log.fail(`Estás en '${branch || "(sin rama)"}'. El PR se abre desde la rama feature/* o fix/* de la feature.`); return 1; }

  // 1. Compuertas: informes aprobados y commiteados
  C.log.step(`Compuertas de ${feature}`);
  const bloqueos = [];
  const rep = (k) => path.join(root, "docs", "reviews", `${feature}-${k}.md`);
  const check = (k, re, label) => {
    const f = rep(k);
    if (!fs.existsSync(f)) { bloqueos.push(`falta docs/reviews/${feature}-${k}.md`); return; }
    if (!re.test(fs.readFileSync(f, "utf8"))) bloqueos.push(`${label} no está APROBADO en docs/reviews/${feature}-${k}.md`);
    const st = git(root, `status --porcelain -- "${path.relative(root, f)}"`).out.trim();
    if (st) bloqueos.push(`docs/reviews/${feature}-${k}.md tiene cambios sin commit`);
  };
  check("qa", /^\s*QA:\s*APROBADO/m, "QA");
  if (s.compuertas !== "reducidas") check("codigo", /^\s*CODIGO:\s*APROBADO/m, "Revisión de código");
  check("seguridad", /^\s*VEREDICTO:\s*APROBADO/m, "Seguridad");
  const dirty = git(root, "status --porcelain").out.trim().split(/\r?\n/).filter((l) => l && !l.endsWith(`docs/reviews/${feature}-pr.md`)).join("\n");
  if (dirty) bloqueos.push(`hay cambios sin commit en la rama:\n${dirty.split(/\r?\n/).slice(0, 8).map((l) => "      " + l).join("\n")}`);
  if (bloqueos.length) { C.log.red("PR BLOQUEADO:"); bloqueos.forEach((b) => C.log.fail(b)); return 1; }
  C.log.ok("QA, seguridad" + (s.compuertas !== "reducidas" ? " y revisión de código" : "") + " aprobados y commiteados; rama limpia");
  const ticket = (s.ticket || "").toUpperCase();
  const spec = path.join(root, "docs", "specs", `${feature}.md`);
  const title = (() => {
    let t = feature.replace(/^([A-Z][A-Z0-9]+-\d+)-/, "").replace(/-/g, " ");
    if (fs.existsSync(spec)) { const m = /^#\s+(?:Spec:\s*)?(.+)$/m.exec(fs.readFileSync(spec, "utf8")); if (m) t = m[1].trim(); }
    const tipo = s.type === "bugfix" ? "fix" : "feat";
    return `${tipo}: ${ticket ? ticket + " " : ""}${t}`.slice(0, 120);
  })();

  // 2. Descripción del PR
  const rel = (p) => path.relative(root, p).replace(/\\/g, "/");
  const docs = [["Spec", spec], ["ADR", path.join(root, "docs", "adr", `${feature}.md`)], ["QA", rep("qa")], ["Revisión de código", rep("codigo")], ["Seguridad", rep("seguridad")]].filter(([, p]) => fs.existsSync(p));
  const log = git(root, `log --oneline ${base}..HEAD`).out.trim() || git(root, "log --oneline -20").out.trim();
  const body = [
    `## ${title}`, "",
    ticket ? `Ticket: ${ticket}` : "", `Rama: \`${branch}\` → \`${base}\``, `Compuertas: QA APROBADO · Seguridad APROBADO${s.compuertas === "reducidas" ? " · modo rápido (sin revisión de código)" : " · Revisión de código APROBADO"}`, "",
    "### Documentos", ...docs.map(([n, p]) => `- ${n}: \`${rel(p)}\``), "",
    "### Commits", "```", log, "```", "",
    "### Cómo probar", fs.existsSync(rep("qa")) ? "Ver la sección de pruebas de `" + rel(rep("qa")) + "`." : "(ver informe de QA)", "",
    "Generado por multiagent-kit.",
  ].filter((l) => l !== "").join("\n") + "\n";
  // La descripción se versiona (va en la rama); el estado del PR es local de esta máquina (.pipeline/pr/<slug>.json)
  const prDoc = rep("pr");
  fs.mkdirSync(path.dirname(prDoc), { recursive: true });
  const docTxt = `# PR — ${feature}\n\nTítulo: ${title}\nBase: ${base}\nFecha: ${C.nowIso()}\n\n---\n\n${body}`;
  if (!fs.existsSync(prDoc) || fs.readFileSync(prDoc, "utf8").split("\n").slice(6).join("\n") !== docTxt.split("\n").slice(6).join("\n")) {
    fs.writeFileSync(prDoc, docTxt, "utf8");
    git(root, `add "${path.relative(root, prDoc)}"`);
    const cm = git(root, `commit -m "docs: ${ticket ? ticket + " " : ""}descripción del PR de ${feature}"`);
    if (cm.code === 0) C.log.ok(`docs/reviews/${feature}-pr.md commiteado`);
  }
  const finish = (estado, detalle, url) => {
    const line = estado === "CREADO" ? `PR: CREADO ${url}` : `PR: ${estado} (${detalle})`;
    C.writeJson(path.join(root, ".pipeline", "pr", `${feature}.json`), { feature, branch, base, estado, detalle: detalle || "", url: url || "", title, at: C.nowIso() });
    C.setState(root, { pr_base: base, pr_estado: estado.toLowerCase().replace(" ", "_"), pr_url: url || "", stage: "entrega" });
    C.log.green("\n" + line);
    return 0;
  };
  if (opts["sin-push"]) return finish("RAMA LOCAL", "sin push por petición (--sin-push); descripción en docs/reviews/" + feature + "-pr.md");

  // 3. Push
  C.log.step(`git push -u origin ${branch}`);
  const push = git(root, `push -u origin "${branch}"`);
  if (push.code !== 0) {
    const lines = push.out.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const motivo = lines.find((l) => /fatal|error|rejected|denied|not found|could not/i.test(l)) || lines.pop() || "sin detalle";
    C.log.fail(motivo); return finish("RAMA LOCAL", `push falló: ${motivo}`);
  }
  C.log.ok("rama subida");

  // 4. PR con gh (opcional)
  if (!C.which("gh")) return finish("RAMA SUBIDA", "gh CLI no instalado: abre el PR en GitHub con la descripción de docs/reviews/" + feature + "-pr.md");
  const bodyFile = path.join(root, ".pipeline", `pr-body-${feature}.md`);
  fs.writeFileSync(bodyFile, body, "utf8");
  C.log.step(`gh pr create --base ${base}`);
  const existing = C.run(`gh pr view "${branch}" --json url -q .url`, { cwd: root, quiet: true, ignoreFailure: true });
  if (existing.code === 0 && /^https?:/.test(existing.out.trim())) { C.log.ok("ya existía un PR para esta rama"); return finish("CREADO", "", existing.out.trim()); }
  const r = C.run(`gh pr create --base "${base}" --head "${branch}" --title "${title.replace(/"/g, "'")}" --body-file "${bodyFile}"`, { cwd: root, quiet: true, ignoreFailure: true });
  const url = (r.out.match(/https?:\/\/\S+/) || [])[0];
  if (r.code === 0 && url) { C.log.ok(url); return finish("CREADO", "", url); }
  return finish("RAMA SUBIDA", `gh pr create falló: ${r.out.trim().split(/\r?\n/).pop() || "sin detalle"}; abre el PR a mano con docs/reviews/${feature}-pr.md`);
};
