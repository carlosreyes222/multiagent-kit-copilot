// Lanzadores (comando global `kit` y hooks de usuario): con los kits de Claude y de Copilot instalados a la vez deben
// elegir el plugin correcto, no "el más reciente".
"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const H = require("./_helpers");
const L = require(path.join(H.SCRIPTS, "launcher-src.js"));

function fakePlugin(dir, flavor, version, mtimeOffsetSec = 0) {
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "scripts", "common.js"), "");
  const manifest = flavor === "copilot" ? path.join(dir, "plugin.json") : path.join(dir, ".claude-plugin", "plugin.json");
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, JSON.stringify({ name: "multiagent-kit", version }));
  const t = new Date(Date.now() + mtimeOffsetSec * 1000);
  fs.utimesSync(dir, t, t);
  return dir;
}
// Ejecuta el resolvedor de un lanzador generado y devuelve la ruta elegida.
function resolve(source, marker, { home, cwd, env }) {
  const file = path.join(home, `launcher-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(file, source.slice(0, source.indexOf(marker)) + "\nconsole.log(findPlugin() || '');\n");
  const e = Object.assign({}, H.ENV, { HOME: home, USERPROFILE: home }, env || {});
  delete e.COPILOT_HOME; delete e.CLAUDE_CONFIG_DIR;
  const r = spawnSync(process.execPath, [file], { cwd, env: e, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout.trim();
}

describe("resolución del plugin", () => {
  let home, copilot, copilotOld, claude, projCopilot, projClaude;
  before(() => {
    home = H.tmpDir("kit-home-");
    copilotOld = fakePlugin(path.join(home, ".copilot", "installed-plugins", "otro-mkt", "multiagent-kit"), "copilot", "1.6.0", 120);
    copilot = fakePlugin(path.join(home, ".copilot", "installed-plugins", "carlos-kits-copilot", "multiagent-kit"), "copilot", "2.0.0", -60);
    claude = fakePlugin(path.join(home, ".claude", "plugins", "cache", "carlos-kits", "multiagent-kit", "2.3.0"), "claude", "2.3.0", 600); // el más reciente
    projCopilot = path.join(home, "app-rn");
    fs.mkdirSync(path.join(projCopilot, ".pipeline"), { recursive: true });
    fs.writeFileSync(path.join(projCopilot, "pipeline.config.json"), "{}");
    fs.writeFileSync(path.join(projCopilot, "AGENTS.md"), "");
    projClaude = path.join(home, "api");
    fs.mkdirSync(projClaude, { recursive: true });
    fs.writeFileSync(path.join(projClaude, "pipeline.config.json"), "{}");
    fs.writeFileSync(path.join(projClaude, "CLAUDE.md"), "");
  });
  after(() => H.rm(home));

  const hookSrc = () => L.hookLauncher({ preferred: path.join(home, "no-existe") });
  const globalSrc = () => L.globalLauncher({ preferred: path.join(home, "no-existe"), flavor: "copilot" });
  const HOOK_MARK = "const plugin = findPlugin();", GLOBAL_MARK = "const [cmd";

  test("hooks de Copilot: el plugin de Copilot aunque el de Claude sea más reciente", () => {
    assert.strictEqual(resolve(hookSrc(), HOOK_MARK, { home, cwd: projCopilot }), copilot);
  });
  test("entre dos instalaciones de Copilot gana la versión más alta, no la fecha", () => {
    assert.strictEqual(resolve(hookSrc(), HOOK_MARK, { home, cwd: home }), copilot);
  });
  test("la ruta preferida (plugin que generó el lanzador) va primero", () => {
    assert.strictEqual(resolve(L.hookLauncher({ preferred: copilotOld }), HOOK_MARK, { home, cwd: home }), copilotOld);
  });
  test("una ruta preferida de Claude no vale para los hooks de Copilot", () => {
    assert.strictEqual(resolve(L.hookLauncher({ preferred: claude }), HOOK_MARK, { home, cwd: home }), copilot);
  });
  test("kit global: proyecto con AGENTS.md -> Copilot; con CLAUDE.md -> Claude", () => {
    assert.strictEqual(resolve(globalSrc(), GLOBAL_MARK, { home, cwd: projCopilot }), copilot);
    assert.strictEqual(resolve(globalSrc(), GLOBAL_MARK, { home, cwd: projClaude }), claude);
  });
  test("kit global: pluginRoot de .pipeline/kit.json de otro sabor se ignora", () => {
    fs.writeFileSync(path.join(projCopilot, ".pipeline", "kit.json"), JSON.stringify({ pluginRoot: claude }));
    try { assert.strictEqual(resolve(globalSrc(), GLOBAL_MARK, { home, cwd: projCopilot }), copilot); }
    finally { fs.rmSync(path.join(projCopilot, ".pipeline", "kit.json")); }
  });
  test("kit global: pluginRoot de .pipeline/kit.json del mismo sabor se respeta", () => {
    fs.writeFileSync(path.join(projCopilot, ".pipeline", "kit.json"), JSON.stringify({ pluginRoot: copilotOld }));
    try { assert.strictEqual(resolve(globalSrc(), GLOBAL_MARK, { home, cwd: projCopilot }), copilotOld); }
    finally { fs.rmSync(path.join(projCopilot, ".pipeline", "kit.json")); }
  });
  test("KIT_PLUGIN_ROOT manda si es del sabor correcto", () => {
    assert.strictEqual(resolve(hookSrc(), HOOK_MARK, { home, cwd: home, env: { KIT_PLUGIN_ROOT: copilotOld } }), copilotOld);
    assert.strictEqual(resolve(hookSrc(), HOOK_MARK, { home, cwd: home, env: { KIT_PLUGIN_ROOT: claude } }), copilot);
  });
  test("sin plugin de Copilot instalado, el lanzador de hooks no usa el de Claude", () => {
    const h2 = H.tmpDir("kit-home2-");
    try {
      fakePlugin(path.join(h2, ".claude", "plugins", "cache", "carlos-kits", "multiagent-kit", "2.3.0"), "claude", "2.3.0");
      assert.strictEqual(resolve(hookSrc(), HOOK_MARK, { home: h2, cwd: h2 }), "");
    } finally { H.rm(h2); }
  });
  test("los lanzadores generados son JavaScript válido", () => {
    for (const src of [hookSrc(), globalSrc()]) {
      const f = path.join(home, `chk-${Math.random().toString(36).slice(2)}.js`);
      fs.writeFileSync(f, src);
      assert.strictEqual(spawnSync(process.execPath, ["--check", f]).status, 0);
    }
  });
});
