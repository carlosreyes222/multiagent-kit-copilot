// Estado del pipeline: escrituras concurrentes sin pérdidas, validación de valores y recuperación de un JSON corrupto.
"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const H = require("./_helpers");

const readState = (dir) => JSON.parse(fs.readFileSync(path.join(dir, ".pipeline", "state.json"), "utf8"));
function kitAsync(dir, args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(H.SCRIPTS, "cli.js"), ...args], { cwd: dir, env: H.ENV });
    let out = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
  });
}

describe("kit state", () => {
  let dir;
  before(() => { dir = H.makeProject({}, { branch: "feature/x" }); });
  after(() => H.rm(dir));

  test("escrituras en paralelo no pierden claves (revisores a la vez)", async () => {
    const sets = {
      qa: "APROBADO", codigo: "RECHAZADO", seguridad: "APROBADO", tamano: "M", compuertas: "completas", ticket: "ABC-9", epica: "pagos",
      pr_base: "develop", sdk: "core", sdk_version: "1.0.0-local.1", stage: "revisiones", type: "feature", mode: "existente", qa_iter: 2, codigo_iter: 1, feature: "ABC-9-pagos",
    };
    for (let round = 0; round < 3; round++) {
      H.runKit(dir, ["state", "reset"]);
      const results = await Promise.all(Object.entries(sets).map(([k, v]) => kitAsync(dir, ["state", `${k}=${v}`])));
      results.forEach((r) => assert.strictEqual(r.code, 0, r.out));
      const s = readState(dir);
      for (const [k, v] of Object.entries(sets)) assert.strictEqual(s[k], v, `ronda ${round}: se perdió ${k}`);
    }
    assert.ok(!fs.existsSync(path.join(dir, ".pipeline", "state.json.lock")), "el lock debe liberarse");
  });

  const invalid = ["qa=APROBAD", "feature=../../etc", "feature=con espacio", "stage=produccion", "type=hotfix", "ticket=nada", "pr_base=a..b", "qa_iter=-1", "compuertas=todas"];
  for (const kv of invalid) {
    test(`rechaza ${kv}`, () => {
      const r = H.runKit(dir, ["state", kv]);
      assert.strictEqual(r.code, 1, r.out);
      assert.match(r.out, /no válido/);
    });
  }
  test("normaliza mayúsculas de veredictos y ticket", () => {
    assert.strictEqual(H.runKit(dir, ["state", "qa=aprobado", "ticket=abc-12", "stage=pr"]).code, 0);
    const s = readState(dir);
    assert.deepStrictEqual([s.qa, s.ticket, s.stage], ["APROBADO", "ABC-12", "pr"]);
  });
  test("un state.json corrupto se aparta con copia y el estado sigue", () => {
    fs.writeFileSync(path.join(dir, ".pipeline", "state.json"), "{ roto");
    const r = H.runKit(dir, ["state", "stage=qa"]);
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /corrupto/);
    assert.ok(fs.readdirSync(path.join(dir, ".pipeline")).some((f) => f.startsWith("state.json.corrupto-")));
    assert.strictEqual(readState(dir).stage, "qa");
  });
  test("reset archiva en historial.jsonl", () => {
    H.runKit(dir, ["state", "feature=ABC-1-algo"]);
    assert.strictEqual(H.runKit(dir, ["state", "reset"]).code, 0);
    const hist = fs.readFileSync(path.join(dir, ".pipeline", "historial.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.strictEqual(hist.pop().feature, "ABC-1-algo");
    assert.strictEqual(readState(dir).feature, "");
  });
  test("kit status muestra las compuertas de su flujo (PR en Copilot, staging/producción en Claude)", () => {
    H.runKit(dir, ["state", "feature=ABC-1-algo"]);
    const r = H.runKit(dir, ["status"]);
    if (H.FLAVOR === "copilot") { assert.match(r.out, /Compuertas para el PR/); assert.doesNotMatch(r.out, /staging_ok =/); }
    else { assert.match(r.out, /Compuertas para producción/); assert.match(r.out, /staging_ok = /); }
  });
});

describe("veredictos de los informes", () => {
  const C = require(path.join(H.SCRIPTS, "common.js"));
  const cases = [
    ["VEREDICTO: APROBADO", "APROBADO"],
    ["**VEREDICTO: APROBADO**", "APROBADO"],
    ["VEREDICTO: **APROBADO** (con observaciones menores)", "APROBADO"],
    ["# Seguridad\n\nVEREDICTO: RECHAZADO\n", "RECHAZADO"],
    ["VEREDICTO: RECHAZADO\n\n...\n\nVEREDICTO: APROBADO", "CONTRADICTORIO"],
    ["> La línea anterior debe ser exactamente `VEREDICTO: APROBADO`", "PENDIENTE"],
    ["Sin veredicto todavía", "PENDIENTE"],
  ];
  for (const [txt, want] of cases) test(`${JSON.stringify(txt).slice(0, 60)} -> ${want}`, () => assert.strictEqual(C.textVerdict(txt, "VEREDICTO"), want));
  test("CÓDIGO con o sin tilde", () => {
    assert.strictEqual(C.textVerdict("CÓDIGO: APROBADO", "C[OÓ]DIGO"), "APROBADO");
    assert.strictEqual(C.textVerdict("CODIGO: RECHAZADO", "C[OÓ]DIGO"), "RECHAZADO");
  });
  test("la plantilla de seguridad sin rellenar no cuenta como aprobada", () => {
    const tpl = fs.readFileSync(path.join(H.PLUGIN, "templates", "docs", "reviews", "_PLANTILLA-seguridad.md"), "utf8");
    assert.notStrictEqual(C.textVerdict(tpl, "VEREDICTO"), "APROBADO");
  });
  test("protectedMatcher admite comodines", () => {
    const m = C.protectedMatcher(["main", "release_*"]);
    assert.deepStrictEqual(["main", "release_2026", "release", "feature/main", "mainx"].map(m), [true, true, false, false, false]);
  });
});
