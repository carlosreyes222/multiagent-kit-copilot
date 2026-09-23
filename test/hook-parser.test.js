// Unidades del parser de shell del hook y de los detectores (sin lanzar procesos).
"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert");
const H = require("./_helpers");
const hook = require(require("path").join(H.SCRIPTS, "hook.js"));

const toks = (cmd) => hook.parseCommand(cmd).map((s) => s.t);

describe("parseCommand", () => {
  test("separa por && || ; | y saltos de línea respetando comillas", () => {
    assert.deepStrictEqual(toks('git add . && git commit -m "a; b && c" || echo x; ls | wc -l\nnpm test'),
      [["git", "add", "."], ["git", "commit", "-m", "a; b && c"], ["echo", "x"], ["ls"], ["wc", "-l"], ["npm", "test"]]);
  });
  test("abre subórdenes $( ), ` ` y ( )", () => {
    assert.deepStrictEqual(toks("echo $(git push origin main)"), [["echo"], ["git", "push", "origin", "main"]]);
    assert.deepStrictEqual(toks("(cd x && git push)"), [["cd", "x"], ["git", "push"]]);
    assert.deepStrictEqual(toks("echo `git push`"), [["echo"], ["git", "push"]]);
  });
  test("desenvuelve bash -c, cmd /c, pwsh -Command y -EncodedCommand", () => {
    assert.deepStrictEqual(toks("bash -c 'git push origin main'"), [["git", "push", "origin", "main"]]);
    assert.deepStrictEqual(toks('cmd /c "git status"'), [["git", "status"]]);
    assert.deepStrictEqual(toks("pwsh -NoProfile -Command git status"), [["git", "status"]]);
    assert.deepStrictEqual(toks("powershell -enc " + Buffer.from("git status", "utf16le").toString("base64")), [["git", "status"]]);
    assert.deepStrictEqual(toks("FOO=1 BAR=2 sudo env X=1 git push"), [["git", "push"]]);
  });
  test("redirecciones: destino aparte y 2>&1 ignorado", () => {
    const [seg] = hook.parseCommand("npm run build > out.log 2>&1");
    assert.deepStrictEqual(seg.t, ["npm", "run", "build"]);
    assert.deepStrictEqual(seg.redirs, ["out.log"]);
    assert.deepStrictEqual(hook.parseCommand("node x < .env")[0].redirs, [".env"]);
  });
  test("comillas escapadas de sh y de PowerShell", () => {
    assert.deepStrictEqual(toks('git commit -m "di \\"hola\\""'), [["git", "commit", "-m", 'di "hola"']]);
    assert.deepStrictEqual(toks('git commit -m "di `"hola`""'), [["git", "commit", "-m", 'di "hola"']]);
  });
  test("llaves dentro de un token no parten el comando; bloques de PowerShell sí", () => {
    assert.deepStrictEqual(toks("git reset HEAD@{1}"), [["git", "reset", "HEAD@{1}"]]);
    assert.deepStrictEqual(toks("Get-ChildItem | ForEach-Object { Remove-Item $_ -Recurse }"), [["Get-ChildItem"], ["ForEach-Object"], ["Remove-Item", "$_", "-Recurse"]]);
  });
});

describe("parseGit", () => {
  test("opciones globales antes del subcomando", () => {
    const g = hook.parseGit(["git", "-c", "a=b", "--no-pager", "-C", ".", "push", "origin", "main"], process.cwd());
    assert.strictEqual(g.sub, "push");
    assert.deepStrictEqual(g.args, ["origin", "main"]);
  });
});

describe("isSensitive", () => {
  const yes = [".env", "a/.env.local", "C:\\p\\.env.production", "release.keystore", "upload.jks", "cert.p12", "AuthKey_X.p8", "k.pem", "App.mobileprovision",
    "android/app/google-services.json", "ios/GoogleService-Info.plist", "android/keystore.properties", "/home/u/.gradle/gradle.properties", "HEAD:.env", "@.env", "file:///p/.env"];
  const no = [".env.example", ".env.sample", ".env.template", "src/env.ts", "android/gradle.properties", "package.json", "environment.ts", ".envrc.md", "README.md"];
  for (const p of yes) test(`sensible: ${p}`, () => assert.strictEqual(hook.isSensitive(p), true));
  for (const p of no) test(`no sensible: ${p}`, () => assert.strictEqual(hook.isSensitive(p), false));
});

describe("normalize / toolKind", () => {
  const kinds = { run_in_terminal: "bash", bash: "bash", powershell: "bash", Bash: "bash", read_file: "read", view: "read", Read: "read",
    create_file: "edit", replace_string_in_file: "edit", multi_replace_string_in_file: "edit", insert_edit_into_file: "edit", apply_patch: "edit",
    edit: "edit", create: "edit", str_replace_editor: "edit", Write: "edit", MultiEdit: "edit", grep_search: "other", get_terminal_output: "other" };
  for (const [name, kind] of Object.entries(kinds)) test(`${name} -> ${kind}`, () => assert.strictEqual(hook.toolKind(name), kind));
  test("toolArgs como cadena JSON (Copilot CLI)", () => {
    const r = hook.normalize({ toolName: "bash", toolArgs: JSON.stringify({ command: "ls" }), cwd: "/x" });
    assert.deepStrictEqual([r.tool, r.command, r.cwd], ["bash", "ls", "/x"]);
  });
});
