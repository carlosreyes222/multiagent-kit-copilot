// Documentos de trabajo (2.2.0): fuera de git y, al cerrar la feature, archivados en el perfil (~/.multiagent-kit/archivo).
"use strict";
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const H = require("./_helpers");

const SLUG = "ABC-7-login";
const archive = (dir, slug) => path.join(H.ENV.KIT_HOME, "archivo", path.basename(dir), slug);
function put(dir, rel, txt) { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); }
function featureDocs(dir, slug) {
  put(dir, `docs/specs/${slug}.md`, "# Spec: Login\n");
  put(dir, `docs/adr/${slug}.md`, "# ADR\n");
  put(dir, `docs/reviews/${slug}-qa.md`, "QA: APROBADO\n");
  put(dir, `docs/reviews/${slug}-pr.md`, "# PR\n");
  put(dir, `.pipeline/pr/${slug}.json`, JSON.stringify({ feature: slug, estado: "CREADO", url: "https://github.com/o/r/pull/1" }));
}

describe("archivo de features", () => {
  let dir;
  beforeEach(() => { dir = H.makeProject({}, { branch: `feature/${SLUG}` }); });
  afterEach(() => { H.rm(dir); H.rm(path.join(H.ENV.KIT_HOME, "archivo", path.basename(dir))); });

  test("kit state reset mueve spec, ADR, informes y estado del PR al archivo del perfil", () => {
    featureDocs(dir, SLUG);
    put(dir, "docs/reviews/OTRA-1-x-qa.md", "QA: APROBADO\n");
    H.writeState(dir, { feature: SLUG, ticket: "ABC-7", pr_url: "https://github.com/o/r/pull/1", pr_estado: "creado" });
    const r = H.runKit(dir, ["state", "reset"]);
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /archivados en/);
    const a = archive(dir, SLUG);
    for (const rel of [`docs/specs/${SLUG}.md`, `docs/adr/${SLUG}.md`, `docs/reviews/${SLUG}-qa.md`, `docs/reviews/${SLUG}-pr.md`, `pipeline/pr/${SLUG}.json`]) assert.ok(fs.existsSync(path.join(a, rel)), `falta ${rel} en el archivo`);
    for (const rel of [`docs/specs/${SLUG}.md`, `docs/reviews/${SLUG}-qa.md`, `.pipeline/pr/${SLUG}.json`]) assert.ok(!fs.existsSync(path.join(dir, rel)), `${rel} debía salir del proyecto`);
    assert.ok(fs.existsSync(path.join(dir, "docs/reviews/OTRA-1-x-qa.md")), "no toca documentos de otras features");
    const meta = JSON.parse(fs.readFileSync(path.join(a, "archivo.json"), "utf8"));
    assert.deepStrictEqual([meta.feature, meta.ticket, meta.pr_url], [SLUG, "ABC-7", "https://github.com/o/r/pull/1"]);
    const ls = H.runKit(dir, ["archivo"]);
    assert.match(ls.out, new RegExp(`${SLUG}\\s+https://github.com/o/r/pull/1`));
    assert.match(H.runKit(dir, ["archivo", SLUG]).out, /docs\/specs\/ABC-7-login\.md/);
  });
  test("--sin-archivar deja los documentos donde están", () => {
    featureDocs(dir, SLUG);
    H.writeState(dir, { feature: SLUG });
    assert.strictEqual(H.runKit(dir, ["state", "reset", "--sin-archivar"]).code, 0);
    assert.ok(fs.existsSync(path.join(dir, `docs/specs/${SLUG}.md`)));
    assert.ok(!fs.existsSync(archive(dir, SLUG)));
  });
  test("documentos versionados (repos anteriores): se copian, no se mueven, y avisa", () => {
    featureDocs(dir, SLUG);
    fs.writeFileSync(path.join(dir, ".git", "info", "exclude"), "");
    H.git(dir, "add", "docs"); H.git(dir, "commit", "-q", "-m", "docs: informes");
    H.writeState(dir, { feature: SLUG });
    const r = H.runKit(dir, ["state", "reset"]);
    assert.match(r.out, /versionado en git: copiado, no movido/);
    assert.ok(fs.existsSync(path.join(dir, `docs/specs/${SLUG}.md`)), "el versionado sigue en el proyecto");
    assert.ok(fs.existsSync(path.join(archive(dir, SLUG), `docs/specs/${SLUG}.md`)));
    assert.strictEqual(H.git(dir, "status", "--porcelain"), "", "no deja cambios en git");
  });
  test("kit state archivar <slug> para features cerradas antes; rechaza la feature en curso y slugs peligrosos", () => {
    featureDocs(dir, "ABC-1-viejo");
    H.writeState(dir, { feature: SLUG });
    assert.strictEqual(H.runKit(dir, ["state", "archivar", "ABC-1-viejo"]).code, 0);
    assert.ok(fs.existsSync(path.join(archive(dir, "ABC-1-viejo"), "archivo.json")));
    assert.strictEqual(H.runKit(dir, ["state", "archivar", SLUG]).code, 1);
    assert.strictEqual(H.runKit(dir, ["state", "archivar", "../x"]).code, 1);
    assert.strictEqual(H.runKit(dir, ["state", "archivar", "NADA-1-y"]).code, 1, "sin documentos no hay nada que archivar");
  });
  test("la épica cuenta las HU archivadas como terminadas y, completa, se archiva también", () => {
    assert.strictEqual(H.runKit(dir, ["epica", "add", "login", "ABC-1-uno", "Uno", "ABC-1"]).code, 0);
    assert.strictEqual(H.runKit(dir, ["epica", "add", "login", "ABC-2-dos", "Dos", "ABC-2"]).code, 0);
    featureDocs(dir, "ABC-1-uno");
    H.writeState(dir, { feature: "ABC-1-uno", epica: "login" });
    assert.strictEqual(H.runKit(dir, ["state", "reset"]).code, 0);
    let st = H.runKit(dir, ["epica", "status", "login"]);
    assert.match(st.out, /\[OK\]\s+1\s+ABC-1-uno\s+terminada/);
    assert.match(st.out, /1\/2 HU terminadas/);
    assert.ok(fs.existsSync(path.join(dir, "docs/epicas/login.md")), "incompleta: sigue en el proyecto");
    featureDocs(dir, "ABC-2-dos");
    H.writeState(dir, { feature: "ABC-2-dos", epica: "login" });
    const r = H.runKit(dir, ["state", "reset"]);
    assert.match(r.out, /Épica login completa: archivada/);
    assert.ok(!fs.existsSync(path.join(dir, "docs/epicas/login.md")));
    assert.match(fs.readFileSync(path.join(H.ENV.KIT_HOME, "archivo", path.basename(dir), "_epicas", "login.md"), "utf8"), /ABC-2-dos.*terminada/);
  });
  test("kit doctor: excluye con --fix y avisa de documentos versionados y PR sin archivar", () => {
    fs.writeFileSync(path.join(dir, ".git", "info", "exclude"), "");
    put(dir, "docs/specs/ABC-3-z.md", "# Spec\n");
    H.git(dir, "add", "docs"); H.git(dir, "commit", "-q", "-m", "docs: spec");
    put(dir, ".pipeline/pr/ABC-4-w.json", "{}");
    let r = H.runKit(dir, ["doctor"]);
    assert.match(r.out, /Documentos de trabajo sin excluir de git/);
    assert.match(r.out, /1 documento\(s\) de trabajo versionados/);
    assert.match(r.out, /git rm -r --cached docs\/specs/);
    assert.match(r.out, /sin archivar: ABC-4-w/);
    H.runKit(dir, ["doctor", "--fix"]);
    const ex = fs.readFileSync(path.join(dir, ".git", "info", "exclude"), "utf8");
    for (const w of H.WORK_DOCS) assert.ok(ex.includes("/" + w), `falta /${w} en exclude`);
    assert.ok(fs.existsSync(path.join(dir, "docs/specs/ABC-3-z.md")), "doctor no toca el índice ni los archivos");
    assert.strictEqual(H.git(dir, "ls-files", "docs"), "docs/specs/ABC-3-z.md");
  });
});

describe("restaurar una feature archivada", () => {
  test("kit state restaurar devuelve los documentos y la épica vuelve a verla en curso", () => {
    const dir = H.makeProject({}, { branch: `feature/${SLUG}` });
    try {
      featureDocs(dir, SLUG);
      H.writeState(dir, { feature: SLUG });
      H.runKit(dir, ["state", "reset"]);
      assert.ok(!fs.existsSync(path.join(dir, `docs/specs/${SLUG}.md`)));
      put(dir, `docs/adr/${SLUG}.md`, "# ADR nuevo\n");
      const r = H.runKit(dir, ["state", "restaurar", SLUG]);
      assert.strictEqual(r.code, 0, r.out);
      assert.match(r.out, /ya existía en el proyecto/);
      assert.strictEqual(fs.readFileSync(path.join(dir, `docs/adr/${SLUG}.md`), "utf8"), "# ADR nuevo\n", "no pisa lo que ya hay");
      assert.ok(fs.existsSync(path.join(dir, `docs/specs/${SLUG}.md`)));
      assert.ok(fs.existsSync(path.join(dir, `.pipeline/pr/${SLUG}.json`)));
      assert.ok(!fs.existsSync(archive(dir, SLUG)), "sale del archivo");
      assert.strictEqual(H.runKit(dir, ["state", "restaurar", SLUG]).code, 1);
    } finally { H.rm(dir); }
  });
});
