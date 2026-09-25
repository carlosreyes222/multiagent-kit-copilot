// kit pr: compuertas (informes aprobados y del código actual, fuera de git), resumen en la descripción, push a un origin
// local y gh simulado.
"use strict";
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const H = require("./_helpers");

const FEATURE = "ABC-7-login";
const NO_GH = { KIT_GH_BIN: path.join(__dirname, "no-existe-gh") };

// Proyecto con origin (repo bare local), rama develop publicada, rama de la feature con código e informes aprobados.
function setup({ reports = true, commitInReports = true, versionedDocs = false } = {}) {
  const dir = H.makeProject({ PROTECTED_BRANCHES: ["main", "develop"] }, { versionedDocs });
  const origin = H.tmpDir("kit-origin-");
  H.git(origin, "init", "-q", "--bare", "-b", "main");
  H.git(dir, "remote", "add", "origin", origin);
  H.git(dir, "push", "-q", "origin", "main");
  H.git(dir, "checkout", "-q", "-b", "develop");
  H.git(dir, "push", "-q", "origin", "develop");
  H.git(dir, "checkout", "-q", "-b", `feature/${FEATURE}`);
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "login.ts"), "export const x = 1;\n");
  H.git(dir, "add", ".");
  H.git(dir, "commit", "-q", "-m", "feat: ABC-7 login");
  const sha = H.git(dir, "rev-parse", "--short", "HEAD");
  fs.mkdirSync(path.join(dir, "docs", "specs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "specs", `${FEATURE}.md`), "# Spec: Login biométrico\n\n## Criterios de aceptación\n\n- **CA-1** — Dado un usuario enrolado, cuando pone la huella, entra.\n\n## Fuera de alcance\nNada.\n");
  fs.mkdirSync(path.join(dir, "docs", "adr"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "adr", `${FEATURE}.md`), "# ADR: Login\n\n## Decisión\nreact-native-biometrics con fallback a PIN.\n\n## Diseño\n…\n");
  if (reports) {
    const c = commitInReports ? `COMMIT: ${sha}\n` : "";
    writeReport(dir, "qa", `# QA\n${c}\nQA: APROBADO\n\n## Cómo probar\n1. Abrir la app en el emulador Android.\n2. Login con huella.\n`);
    writeReport(dir, "codigo", `# Código\n${c}\nCODIGO: APROBADO\n`);
    writeReport(dir, "seguridad", `# Seguridad\n\nVEREDICTO: APROBADO\n${c}`);
  }
  if (versionedDocs) { H.git(dir, "add", "."); H.git(dir, "commit", "-q", "-m", "docs: ABC-7 informes"); }
  H.writeState(dir, { feature: FEATURE, ticket: "ABC-7", type: "feature", pr_base: "develop" });
  return { dir, origin, sha };
}
function writeReport(dir, kind, txt) {
  fs.mkdirSync(path.join(dir, "docs", "reviews"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "reviews", `${FEATURE}-${kind}.md`), txt);
}
const commitAll = (dir, msg) => { H.git(dir, "add", "."); H.git(dir, "commit", "-q", "-m", msg); };

// kit pr solo existe en el kit de Copilot; en el de Claude el flujo sigue con staging y producción.
describe("kit pr en el kit de Claude", { skip: H.FLAVOR !== "claude" }, () => {
  test("no existe: indica el flujo de staging", () => {
    const dir = H.makeProject({}, { branch: "feature/x" });
    try {
      const r = H.runKit(dir, ["pr", "--feature", "x", "--base", "develop"]);
      assert.strictEqual(r.code, 1);
      assert.match(r.out, /kit de Copilot/);
    } finally { H.rm(dir); }
  });
});

describe("kit pr", { skip: H.FLAVOR !== "copilot" }, () => {
  let ctx;
  beforeEach(() => { ctx = null; });
  afterEach(() => { if (ctx) { H.rm(ctx.dir); H.rm(ctx.origin); } });

  test("sin gh: sube la rama, deja la descripción fuera de git y sale con 2 (entrega parcial)", () => {
    ctx = setup();
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop"], { env: NO_GH });
    assert.strictEqual(r.code, 2, r.out);
    assert.match(r.out, /PR: RAMA SUBIDA \(gh CLI no instalado/);
    assert.ok(H.git(ctx.origin, "branch", "--list", `feature/${FEATURE}`).includes(FEATURE), "la rama debe estar en origin");
    assert.ok(fs.existsSync(path.join(ctx.dir, "docs", "reviews", `${FEATURE}-pr.md`)));
    assert.strictEqual(H.git(ctx.dir, "status", "--porcelain"), "", "los documentos de trabajo no ensucian la rama");
    assert.strictEqual(H.git(ctx.dir, "ls-files", "docs"), "", "ningún documento de trabajo entra en git");
    assert.doesNotMatch(H.git(ctx.dir, "log", "--oneline"), /descripción del PR/, "kit pr no hace commits");
    const st = JSON.parse(fs.readFileSync(path.join(ctx.dir, ".pipeline", "state.json"), "utf8"));
    assert.strictEqual(st.pr_estado, "rama_subida");
  });
  test("--sin-push: solo comprueba y sale con 0", () => {
    ctx = setup();
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH });
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /PR: RAMA LOCAL/);
  });
  test("bloquea si falta un informe", () => {
    ctx = setup({ reports: false });
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop"], { env: NO_GH });
    assert.strictEqual(r.code, 1);
    assert.match(r.out, /PR BLOQUEADO/);
    assert.match(r.out, /falta docs\/reviews\/ABC-7-login-qa\.md/);
  });
  test("bloquea con veredictos contradictorios", () => {
    ctx = setup();
    writeReport(ctx.dir, "seguridad", `VEREDICTO: RECHAZADO\n\nCOMMIT: ${ctx.sha}\n\nVEREDICTO: APROBADO\n`);
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop"], { env: NO_GH });
    assert.strictEqual(r.code, 1);
    assert.match(r.out, /contradictorios/);
  });
  test("bloquea si el código cambió después de la revisión", () => {
    ctx = setup();
    fs.writeFileSync(path.join(ctx.dir, "src", "login.ts"), "export const x = 2;\n");
    commitAll(ctx.dir, "fix: ABC-7 cambio tardío");
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop"], { env: NO_GH });
    assert.strictEqual(r.code, 1);
    assert.match(r.out, /después cambió código \(src\/login\.ts\)/);
  });
  test("cambios solo en docs/ después de la revisión no bloquean", () => {
    ctx = setup();
    fs.writeFileSync(path.join(ctx.dir, "docs", "ARQUITECTURA.md"), "# Arquitectura\n");
    commitAll(ctx.dir, "docs: ABC-7 arquitectura");
    assert.strictEqual(H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH }).code, 0);
  });
  test("informes sin COMMIT: avisa pero no bloquea (compatibilidad)", () => {
    ctx = setup({ commitInReports: false });
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH });
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /no indica 'COMMIT: <sha>'/);
  });
  test("la descripción resume spec, ADR e informes (no enlaza archivos que no están en git)", () => {
    ctx = setup();
    assert.strictEqual(H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH }).code, 0);
    const doc = fs.readFileSync(path.join(ctx.dir, "docs", "reviews", `${FEATURE}-pr.md`), "utf8");
    assert.match(doc, /Título: feat: ABC-7 Login biométrico/);
    assert.match(doc, new RegExp(`- QA: \\*\\*APROBADO\\*\\* \\(commit \`${ctx.sha}`));
    assert.match(doc, /- Revisión de código: \*\*APROBADO\*\*/);
    assert.match(doc, /- Seguridad: \*\*APROBADO\*\*/);
    assert.match(doc, /### Criterios de aceptación \(spec\)\n- \*\*CA-1\*\*/);
    assert.match(doc, /### Decisión técnica \(ADR\)\nreact-native-biometrics con fallback a PIN\./);
    assert.match(doc, /### Cómo probar\n1\. Abrir la app en el emulador Android\.\n2\. Login con huella\./);
    assert.doesNotMatch(doc, /docs\/specs\/|docs\/adr\/|docs\/reviews\/ABC-7-login-qa/, "sin enlaces a archivos fuera de git");
    assert.doesNotMatch(doc, /Fuera de alcance|## Diseño/, "solo la sección pedida");
  });
  test("informes sin excluir (clon sin kit update): siguen sin bloquear la rama", () => {
    ctx = setup();
    fs.writeFileSync(path.join(ctx.dir, ".git", "info", "exclude"), "");
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH });
    assert.strictEqual(r.code, 0, r.out);
  });
  test("repos que aún versionan los informes: cambios sin commit en ellos no bloquean, pero avisa", () => {
    ctx = setup({ versionedDocs: true });
    fs.appendFileSync(path.join(ctx.dir, "docs", "reviews", `${FEATURE}-qa.md`), "\nNota posterior.\n");
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH });
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /documento\(s\) de trabajo versionados/);
  });
  test("bloquea con cambios sin commit", () => {
    ctx = setup();
    fs.writeFileSync(path.join(ctx.dir, "src", "tmp.ts"), "x");
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop"], { env: NO_GH });
    assert.strictEqual(r.code, 1);
    assert.match(r.out, /cambios sin commit/);
  });
  test("base inexistente: bloquea sin hacer push", () => {
    ctx = setup();
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "no-existe"], { env: NO_GH });
    assert.strictEqual(r.code, 1);
    assert.match(r.out, /no existe ni en origin ni en local/);
    assert.strictEqual(H.git(ctx.origin, "branch", "--list", `feature/${FEATURE}`), "");
  });
  test("base solo en origin: usa origin/<base> para la lista de commits", () => {
    ctx = setup();
    H.git(ctx.dir, "branch", "-q", "-D", "develop");
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH });
    assert.strictEqual(r.code, 0, r.out);
    const doc = fs.readFileSync(path.join(ctx.dir, "docs", "reviews", `${FEATURE}-pr.md`), "utf8");
    assert.match(doc, /feat: ABC-7 login/);
    assert.doesNotMatch(doc, /\binit\b/, "no debe listar commits que ya están en la base");
  });
  test("avisa si la rama va por detrás de la base", () => {
    ctx = setup();
    H.git(ctx.dir, "checkout", "-q", "develop");
    fs.writeFileSync(path.join(ctx.dir, "otro.txt"), "x");
    commitAll(ctx.dir, "chore: otro");
    H.git(ctx.dir, "push", "-q", "origin", "develop");
    H.git(ctx.dir, "checkout", "-q", `feature/${FEATURE}`);
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH });
    assert.match(r.out, /1 commit\(s\) por detrás de origin\/develop/);
  });
  test("modo rápido (compuertas=reducidas) no exige revisión de código", () => {
    ctx = setup();
    fs.rmSync(path.join(ctx.dir, "docs", "reviews", `${FEATURE}-codigo.md`));
    H.writeState(ctx.dir, { feature: FEATURE, ticket: "ABC-7", compuertas: "reducidas" });
    assert.strictEqual(H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop", "--sin-push"], { env: NO_GH }).code, 0);
  });
  test("desde una rama protegida no abre PR", () => {
    ctx = setup();
    H.git(ctx.dir, "checkout", "-q", "develop");
    assert.strictEqual(H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "main"], { env: NO_GH }).code, 1);
  });
  test("el título de la spec nunca se ejecuta como comando (sin shell)", () => {
    ctx = setup();
    const marker = path.join(ctx.dir, "PWNED");
    const evil = `# Spec: Login $(node -e "require('fs').writeFileSync('PWNED','x')") \`node -e "require('fs').writeFileSync('PWNED','x')"\` & echo x > PWNED`;
    fs.writeFileSync(path.join(ctx.dir, "docs", "specs", `${FEATURE}.md`), evil + "\n");
    // gh simulado con node: acepta --version y falla en pr list / pr create; recibe el título como argumento, sin shell
    const r = H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "develop"], { env: { KIT_GH_BIN: process.execPath } });
    assert.strictEqual(r.code, 2, r.out);
    assert.match(r.out, /gh pr create falló/);
    assert.ok(!fs.existsSync(marker), "el título se interpretó como comando");
  });
  test("slug y base con caracteres peligrosos se rechazan", () => {
    ctx = setup();
    assert.strictEqual(H.runKit(ctx.dir, ["pr", "--feature", "../x", "--base", "develop"], { env: NO_GH }).code, 1);
    assert.strictEqual(H.runKit(ctx.dir, ["pr", "--feature", FEATURE, "--base", "a..b"], { env: NO_GH }).code, 1);
  });
});
