// commit-gate: lint + tests antes de cada commit del agente, también con `git -C`, `cd x &&` y sub-repositorios.
"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const H = require("./_helpers");

const FAIL = "node -e \"console.log('lint roto'); process.exit(3)\"";
const OK = "node -e \"process.exit(0)\"";

describe("commit-gate", () => {
  let failing, passing, outside;
  before(() => {
    failing = H.makeProject({ LINT_CMD: OK, TEST_CMD: FAIL }, { branch: "feature/x" });
    passing = H.makeProject({ LINT_CMD: OK, TEST_CMD: OK }, { branch: "feature/x" });
    outside = H.tmpDir("kit-ajeno-");
    H.git(outside, "init", "-q", "-b", "main");
    // sub-repositorio con su propio .git dentro del proyecto (SUB_REPOS)
    const sub = path.join(failing, "libs", "ui");
    fs.mkdirSync(sub, { recursive: true });
    H.git(sub, "init", "-q", "-b", "feature/x");
  });
  after(() => { H.rm(failing); H.rm(passing); H.rm(outside); });

  const blocked = (cmd, cwd) => H.runHook("commit-gate", H.vscodeBash(cmd, cwd));

  test("bloquea el commit si los tests fallan y muestra la salida", () => {
    const r = blocked("git commit -m x", failing);
    assert.strictEqual(r.code, 2);
    assert.match(r.stderr, /COMMIT BLOQUEADO: Tests falló/);
    assert.match(r.stderr, /lint roto/);
  });
  for (const cmd of ["git -C . commit -m x", "cd . && git commit -m x", "git -c core.x=y commit -m x", "pwsh -Command \"git commit -m x\""]) {
    test(`también con: ${cmd}`, () => assert.strictEqual(blocked(cmd, failing).code, 2));
  }
  test("commit en un sub-repositorio del proyecto pasa por la compuerta del padre", () => {
    assert.strictEqual(blocked("git -C libs/ui commit -m x", failing).code, 2);
    assert.strictEqual(blocked("cd libs/ui && git commit -m x", failing).code, 2);
  });
  test("permite el commit si lint y tests pasan", () => assert.strictEqual(blocked("git commit -m x", passing).code, 0));
  test("no ejecuta nada para comandos que no son commit", () => assert.strictEqual(blocked("git status && npm test", failing).code, 0));
  test("un repositorio ajeno al proyecto no pasa por la compuerta", () => {
    assert.strictEqual(blocked(`git -C "${outside}" commit -m x`, failing).code, 0);
  });
  test("GATE_TESTS_ON_COMMIT=false la desactiva", () => {
    const off = H.makeProject({ TEST_CMD: FAIL, GATE_TESTS_ON_COMMIT: false }, { branch: "feature/x" });
    try { assert.strictEqual(blocked("git commit -m x", off).code, 0); } finally { H.rm(off); }
  });
  test("con la configuración ilegible no ejecuta nada (protect-main ya bloquea)", () => {
    const bad = H.makeProject({}, { branch: "feature/x" });
    fs.writeFileSync(path.join(bad, "pipeline.config.json"), "{");
    try { assert.strictEqual(blocked("git commit -m x", bad).code, 0); } finally { H.rm(bad); }
  });
});
