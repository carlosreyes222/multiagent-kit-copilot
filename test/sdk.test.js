// kit sdk sync: rama configurable (main por defecto), validación del nombre de rama y actualización como mucho cada
// SDK_SYNC_DIAS días cuando la piden los flujos (--auto).
"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const H = require("./_helpers");

const sdkEntry = (extra = {}) => Object.assign({ nombre: "core", tipo: "comando", publicar: "echo x", repo: "" }, extra);
function setConfig(dir, sdks, more = {}) {
  const p = path.join(dir, "pipeline.config.json");
  const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
  fs.writeFileSync(p, JSON.stringify(Object.assign(cfg, { SDKS: sdks }, more), null, 2));
}
const reg = (dir) => JSON.parse(fs.readFileSync(path.join(dir, ".pipeline", "sdks.json"), "utf8")).sdks.core;
const clone = (dir) => path.join(dir, ".pipeline", "sdks", "core");

describe("kit sdk sync", () => {
  let dir, origin, work;
  before(() => {
    // repo del SDK: main y develop publicados en un origin local
    work = H.tmpDir("kit-sdk-src-");
    H.git(work, "init", "-q", "-b", "main");
    fs.writeFileSync(path.join(work, "a.txt"), "main\n");
    H.git(work, "add", "."); H.git(work, "commit", "-q", "-m", "main");
    H.git(work, "checkout", "-q", "-b", "develop");
    fs.writeFileSync(path.join(work, "a.txt"), "develop\n");
    H.git(work, "commit", "-q", "-am", "develop");
    origin = H.tmpDir("kit-sdk-origin-");
    H.git(origin, "init", "-q", "--bare", "-b", "main");
    H.git(work, "remote", "add", "origin", origin);
    H.git(work, "push", "-q", "origin", "main", "develop");
    dir = H.makeProject({}, { branch: "feature/x" });
  });
  after(() => { H.rm(dir); H.rm(origin); H.rm(work); });

  test("sin 'rama' descarga main", () => {
    setConfig(dir, [sdkEntry({ repo: origin })]);
    const r = H.runKit(dir, ["sdk", "sync", "core"]);
    assert.strictEqual(r.code, 0, r.out);
    assert.strictEqual(fs.readFileSync(path.join(clone(dir), "a.txt"), "utf8"), "main\n");
    assert.strictEqual(reg(dir).rama, "main");
    assert.ok(reg(dir).synced_at);
  });
  test("--auto no vuelve a la red si se sincronizó hace menos de SDK_SYNC_DIAS días", () => {
    const antes = reg(dir).synced_at;
    const r = H.runKit(dir, ["sdk", "sync", "--auto"]);
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /core: al día \(sincronizado hace menos de un día, rama main; se actualiza cada 7 días/);
    assert.strictEqual(reg(dir).synced_at, antes);
  });
  test("con 'rama' en la configuración, --auto cambia a esa rama aunque esté reciente", () => {
    setConfig(dir, [sdkEntry({ repo: origin, rama: "develop" })]);
    const r = H.runKit(dir, ["sdk", "sync", "--auto"]);
    assert.strictEqual(r.code, 0, r.out);
    assert.strictEqual(fs.readFileSync(path.join(clone(dir), "a.txt"), "utf8"), "develop\n");
    assert.strictEqual(reg(dir).rama, "develop");
  });
  test("--auto actualiza cuando pasaron más de SDK_SYNC_DIAS días", () => {
    const p = path.join(dir, ".pipeline", "sdks.json");
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    j.sdks.core.synced_at = "2020-01-01T00:00:00";
    fs.writeFileSync(p, JSON.stringify(j));
    const r = H.runKit(dir, ["sdk", "sync", "--auto", "core"]);
    assert.strictEqual(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /al día/);
    assert.notStrictEqual(reg(dir).synced_at, "2020-01-01T00:00:00");
  });
  test("SDK_SYNC_DIAS: 0 actualiza siempre", () => {
    setConfig(dir, [sdkEntry({ repo: origin, rama: "develop" })], { SDK_SYNC_DIAS: 0 });
    assert.doesNotMatch(H.runKit(dir, ["sdk", "sync", "--auto"]).out, /al día/);
    setConfig(dir, [sdkEntry({ repo: origin, rama: "develop" })], { SDK_SYNC_DIAS: 7 });
  });
  test("kit sdk sync (sin --auto) siempre actualiza y --rama cambia la rama puntualmente", () => {
    assert.doesNotMatch(H.runKit(dir, ["sdk", "sync", "core"]).out, /al día/);
    const r = H.runKit(dir, ["sdk", "sync", "core", "--rama", "main"]);
    assert.strictEqual(r.code, 0, r.out);
    assert.strictEqual(fs.readFileSync(path.join(clone(dir), "a.txt"), "utf8"), "main\n");
  });
  for (const bad of ["dev elop", "a..b", "-x", "rama;echo PWNED", "$(touch PWNED)"]) {
    test(`rama no válida se rechaza sin ejecutar nada: ${bad}`, () => {
      setConfig(dir, [sdkEntry({ repo: origin, rama: bad })]);
      const r = H.runKit(dir, ["sdk", "sync", "--auto"]);
      assert.strictEqual(r.code, 1, r.out);
      assert.match(r.out, /'rama' no válida/);
      assert.ok(!fs.existsSync(path.join(dir, "PWNED")));
    });
  }
  test("--rama no válida se rechaza", () => {
    setConfig(dir, [sdkEntry({ repo: origin })]);
    const r = H.runKit(dir, ["sdk", "sync", "core", "--rama", "a b"]);
    assert.strictEqual(r.code, 1, r.out);
    assert.match(r.out, /--rama no válida/);
  });
});
