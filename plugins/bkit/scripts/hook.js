// Hooks del kit (Claude Code y GitHub Copilot). Uso: node hook.js <protect-main|commit-gate|session-start>
// Lee el evento JSON por stdin en cualquiera de los formatos:
//   Claude Code / VS Code (snake_case): { hook_event_name, tool_name, tool_input: {command|filePath|…}, cwd }
//   Copilot CLI (camelCase):            { toolName, toolArgs (cadena JSON), cwd }
// Denegar: escribe JSON {permissionDecision:"deny"} (Copilot y VS Code), mensaje en stderr y sale con 2.
// Los comandos se analizan con un parser de shell (sh, cmd y PowerShell) y no con expresiones sobre el texto crudo:
// `git -C dir push`, `cd dir && git commit`, `pwsh -Command "…"` o `bash -c "…"` se evalúan igual que el comando directo.
// Es una defensa en profundidad, no la barrera final: un script que el agente escriba y ejecute no pasa por aquí.
// La barrera final son las reglas del repositorio en GitHub (docs/09).
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./common");

function readEvent() {
  try { const raw = fs.readFileSync(0, "utf8"); return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; }
}

// --- Evento → { tool: bash|read|edit|other, command, files[], cwd } ------------------------------------------
// Nombres de herramienta de Copilot CLI (bash, powershell, view, edit, create…), VS Code (run_in_terminal, read_file,
// create_file, replace_string_in_file, multi_replace_string_in_file, insert_edit_into_file, apply_patch…) y Claude Code.
function toolKind(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  if (/^(bash|powershell|pwsh|shell|execute|runcommand|terminal)$/.test(n) || /(runin|execin)terminal/.test(n)) return "bash";
  if (/^(view|read|cat)$/.test(n) || /readfile/.test(n)) return "read";
  if (/^(edit|create|write|multiedit|strreplaceeditor|applypatch|notebookedit)$/.test(n) || /(edit|create|write)file|replacestring|insertedit|editnotebook|applypatch/.test(n)) return "edit";
  return "other";
}
const FILE_KEYS = ["file_path", "filePath", "path", "file", "target_file", "targetFile", "notebook_path", "uri"];
function filesFrom(args) {
  const out = [];
  const visit = (o, depth) => {
    if (!o || typeof o !== "object" || depth > 3) return;
    if (Array.isArray(o)) { for (const x of o) visit(x, depth + 1); return; }
    for (const k of FILE_KEYS) if (typeof o[k] === "string" && o[k]) out.push(o[k]);
    for (const k of ["replacements", "edits", "files"]) if (Array.isArray(o[k])) visit(o[k], depth + 1);
  };
  visit(args, 0);
  // apply_patch (VS Code / Codex): "*** Update File: ruta"
  for (const k of ["input", "patch"]) {
    if (typeof args[k] !== "string") continue;
    for (const m of args[k].matchAll(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$|^\*\*\* Move to:\s*(.+?)\s*$/gm)) out.push(m[1] || m[2]);
  }
  return out;
}
function normalize(evt) {
  let name = "", args = null;
  if ("toolName" in evt) { name = evt.toolName; args = evt.toolArgs; }
  else if ("tool_name" in evt) { name = evt.tool_name; args = evt.tool_input; }
  if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = null; } }
  const r = { tool: toolKind(name), command: "", files: [], cwd: evt.cwd || "" };
  // write_bash (Copilot CLI) escribe texto en una shell ya abierta: se evalúa como un comando más
  const writesShell = /^write_?(bash|powershell|shell)$/i.test(String(name || ""));
  if (writesShell) r.tool = "bash";
  if (args && typeof args === "object") {
    for (const k of writesShell ? ["input", "command"] : ["command", "commandLine", "cmd", "script"]) if (typeof args[k] === "string" && args[k]) { r.command = args[k]; break; }
    r.files = filesFrom(args);
  }
  return r;
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    permissionDecision: "deny", permissionDecisionReason: reason,
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  }) + "\n");
  process.stderr.write("BLOQUEADO: " + reason + "\n");
  process.exit(2);
}

// --- Parser de shell -------------------------------------------------------------------------------------------
// Divide un comando en segmentos simples respetando comillas: separa por && || ; | & y saltos de línea, y abre las
// subórdenes $( … ), ( … ), { … } y ` … ` para que nada quede escondido dentro de otra orden. Cada segmento es
// { t: [tokens sin comillas], redirs: [rutas de < > >>] }.
function splitShell(cmd) {
  const segs = [];
  let cur = { t: [], redirs: [] }, tok = "", has = false, q = null, redirNext = false;
  const endTok = () => {
    if (has) { if (redirNext) cur.redirs.push(tok); else cur.t.push(tok); redirNext = false; }
    tok = ""; has = false;
  };
  const endSeg = () => { endTok(); redirNext = false; if (cur.t.length || cur.redirs.length) segs.push(cur); cur = { t: [], redirs: [] }; };
  const s = String(cmd || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], nx = s[i + 1];
    if (q) {
      if (ch === q) { q = null; continue; }
      if (q === '"' && (ch === "\\" || ch === "`") && nx === '"') { tok += '"'; i++; continue; }
      tok += ch; continue;
    }
    if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
    if (ch === "`" && (nx === "\n" || nx === "\r")) { endTok(); i++; continue; } // continuación de línea de PowerShell
    if (ch === "$" && nx === "(") { endSeg(); i++; continue; }
    if (ch === "`" || ch === ")") { endSeg(); continue; }
    if ((ch === "(" || ch === "{" || ch === "}") && !has) { endSeg(); continue; } // HEAD@{1} sigue siendo un token
    if (ch === "&" && nx === "&") { endSeg(); i++; continue; }
    if (ch === "|") { endSeg(); if (nx === "|") i++; continue; }
    if (ch === ";" || ch === "\n" || ch === "\r") { endSeg(); continue; }
    if (ch === "&") { endSeg(); continue; } // cmd: separador · PowerShell: operador de llamada
    if (ch === ">" || ch === "<") {
      if (/^\d$/.test(tok)) { tok = ""; has = false; } else endTok();
      if (nx === ">") i++;
      if (s[i + 1] === "&") { i++; while (/\d/.test(s[i + 1] || "")) i++; continue; } // 2>&1
      redirNext = true; continue;
    }
    if (ch === " " || ch === "\t") { endTok(); continue; }
    tok += ch; has = true;
  }
  endSeg();
  return segs;
}
const progName = (tok) => path.basename(String(tok || "").replace(/\\/g, "/")).toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, "");
// Quita envoltorios (VAR=x, sudo, env, bash -c, cmd /c, pwsh -Command, -EncodedCommand…) y devuelve los segmentos reales.
function parseCommand(cmd, depth = 0) {
  const out = [];
  for (const seg of splitShell(cmd)) {
    const t = seg.t.slice();
    while (t.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0])) t.shift();
    if (!t.length) { if (seg.redirs.length) out.push({ t, redirs: seg.redirs }); continue; }
    const p = progName(t[0]);
    const inner = (text) => { if (depth < 4) out.push(...parseCommand(text, depth + 1)); };
    if (["sudo", "env", "command", "nohup", "time", "exec", "call", "&", "."].includes(p) && t.length > 1) {
      let k = 1; while (k < t.length && (t[k].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[k]))) k++;
      inner(t.slice(k).map(quoteIfNeeded).join(" ") + redirText(seg)); continue;
    }
    if (["bash", "sh", "zsh", "dash", "ksh", "git-bash"].includes(p)) {
      const k = t.findIndex((x, j) => j > 0 && /^-[a-z]*c$/.test(x));
      if (k > 0 && t[k + 1] !== undefined) { inner(t[k + 1]); continue; }
    }
    if (p === "cmd") {
      const k = t.findIndex((x) => /^\/[ck]$/i.test(x));
      if (k > 0) { inner(t.slice(k + 1).join(" ")); continue; }
    }
    if (p === "powershell" || p === "pwsh") {
      const e = t.findIndex((x) => /^-(e|ec|enc|encodedcommand)$/i.test(x));
      if (e > 0 && t[e + 1]) { try { inner(Buffer.from(t[e + 1], "base64").toString("utf16le")); } catch { /* no decodifica */ } continue; }
      const k = t.findIndex((x) => /^-(c|command)$/i.test(x));
      if (k > 0) { inner(t.slice(k + 1).join(" ")); continue; }
    }
    out.push({ t, redirs: seg.redirs });
  }
  return out;
}
const quoteIfNeeded = (x) => (/[\s;&|]/.test(x) ? `"${x.replace(/"/g, '\\"')}"` : x);
const redirText = (seg) => seg.redirs.map((r) => ` > ${quoteIfNeeded(r)}`).join("");

// --- Git: opciones globales y carpeta real -----------------------------------------------------------------------
function resolveDir(base, p) {
  let d = path.resolve(base, p);
  if (!fs.existsSync(d) && C.IS_WIN && /^\/[a-zA-Z]\//.test(p)) d = path.resolve(p[1] + ":" + p.slice(2)); // /c/Users (Git Bash)
  return fs.existsSync(d) ? d : base;
}
function parseGit(t, cwd) {
  let dir = cwd, i = 1;
  while (i < t.length && t[i].startsWith("-")) {
    const o = t[i];
    if (o === "-C") { if (t[i + 1] !== undefined) dir = resolveDir(dir, t[i + 1]); i += 2; continue; }
    if (o === "--work-tree") { if (t[i + 1] !== undefined) dir = resolveDir(dir, t[i + 1]); i += 2; continue; }
    if (o.startsWith("--work-tree=")) { dir = resolveDir(dir, o.slice(12)); i++; continue; }
    if (["-c", "--git-dir", "--namespace", "--super-prefix", "--config-env", "--list-cmds"].includes(o)) { i += 2; continue; }
    i++;
  }
  return { dir, sub: String(t[i] || "").toLowerCase(), args: t.slice(i + 1) };
}

// --- Archivos sensibles: secretos y firma (Android e iOS) ----------------------------------------------------------
function isSensitive(p) {
  let s = String(p || "").trim().replace(/\\/g, "/").replace(/^file:\/\/\/?/i, "").replace(/^@/, "");
  if (!s) return false;
  if (/(^|\/)\.gradle\/gradle\.properties$/i.test(s)) return true; // ~/.gradle/gradle.properties: contraseñas de firma
  const base = s.split("/").pop().split(":").pop().toLowerCase();
  if (/^\.env(\..+)?$/.test(base)) return !/\.(example|sample|template|dist)$/.test(base);
  if (/\.(jks|keystore|p12|pfx|pem|p8|key|mobileprovision)$/.test(base)) return true;
  return ["google-services.json", "googleservice-info.plist", "keystore.properties", "signing.properties", "secrets.properties"].includes(base);
}
const sensitiveIn = (tokens) => tokens.find((x) => isSensitive(x) || isSensitive(String(x).split("=").pop()));
// Programas que leen, copian o escriben el contenido de los archivos que reciben como argumento.
const READERS = new Set(["cat", "type", "more", "less", "head", "tail", "gc", "get-content", "cp", "copy", "copy-item", "cpi", "mv", "move", "move-item", "mi",
  "ren", "rename-item", "base64", "certutil", "xxd", "od", "strings", "openssl", "keytool", "nl", "bat", "code", "notepad", "vi", "vim", "nano", "open",
  "invoke-item", "ii", "tee", "tee-object", "curl", "wget", "scp", "clip", "import-csv", "format-hex", "fhx", "get-filehash"]);
const PATTERN_FIRST = new Set(["grep", "egrep", "fgrep", "rg", "findstr", "select-string", "sls", "sed", "awk"]); // el primer argumento es el patrón
const WRITERS = new Set(["set-content", "sc", "add-content", "ac", "out-file"]); // solo importa el destino (-Path o primer argumento)
function sensitiveArg(p, t) {
  const args = t.slice(1);
  if (READERS.has(p)) return sensitiveIn(args.filter((x) => !/^-/.test(x) || x.includes("=")));
  if (PATTERN_FIRST.has(p)) {
    const files = []; let skipped = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (/^(-e|--regexp|-f|--file)$/.test(a) || /^-pattern$/i.test(a)) { if (/^(-f|--file)$/.test(a)) files.push(args[i + 1] || ""); i++; skipped = true; continue; }
      if (/^-(path|literalpath)$/i.test(a)) { files.push(args[i + 1] || ""); i++; continue; }
      if (a.startsWith("-")) continue;
      if (!skipped) { skipped = true; continue; }
      files.push(a);
    }
    return sensitiveIn(files);
  }
  if (WRITERS.has(p)) {
    const k = args.findIndex((x) => /^-(path|literalpath|filepath)$/i.test(x));
    const target = k >= 0 ? args[k + 1] : args.find((x) => !x.startsWith("-"));
    return target && isSensitive(target) ? target : null;
  }
  return null;
}

// --- Reglas ---------------------------------------------------------------------------------------------------------
const BROAD_PATHS = new Set([".", "./", "*", ":/", ":/*", ".\\", "-A", "--all"]);
const isRecursiveFlag = (x) => /^--recursive$/i.test(x) || (/^-[a-z]+$/i.test(x) && ("recurse".startsWith(x.slice(1).toLowerCase()) || (x.length <= 5 && /r/i.test(x))));

function makeCtx(a, root, cfg) {
  const branches = new Map();
  const ctx = {
    root, cfg,
    protectedLabel: (cfg.PROTECTED_BRANCHES || []).join(", "),
    branchOf: (d) => { if (!branches.has(d)) branches.set(d, C.currentBranch(d)); return branches.get(d); },
    isProtected: C.protectedMatcher(cfg.PROTECTED_BRANCHES),
    ticket: () => { if (ctx._t === undefined) ctx._t = C.FLAVOR === "copilot" ? String(C.getState(root).ticket || "").toUpperCase() : ""; return ctx._t; },
    cwd: a.cwd && fs.existsSync(a.cwd) ? path.resolve(a.cwd) : root,
  };
  return ctx;
}

function checkGit(g, ctx) {
  const { sub, args, dir } = g;
  const branch = () => ctx.branchOf(dir);
  const nonFlags = args.filter((x) => !x.startsWith("-"));
  if (sub === "push") {
    let force = false, all = false, remote = null; const refspecs = [];
    for (let i = 0; i < args.length; i++) {
      const x = args[i];
      if (x === "--") continue;
      if (x.startsWith("--")) {
        if (/^--(force|force-with-lease|force-if-includes)(=|$)/.test(x)) force = true;
        else if (["--mirror", "--all", "--branches"].includes(x)) all = true;
        else if (["--repo", "--receive-pack", "--exec", "--push-option"].includes(x)) i++;
        continue;
      }
      if (/^-[a-zA-Z]+$/.test(x)) { if (x.includes("f")) force = true; if (x === "-o") i++; continue; }
      if (remote === null) { remote = x; continue; }
      refspecs.push(x);
    }
    if (force || refspecs.some((r) => r.startsWith("+"))) deny(`push forzado no permitido a los agentes: git push ${args.join(" ")}`);
    if (all) deny("push de todas las ramas (--all/--mirror) no permitido: sube solo la rama de la feature.");
    const targets = refspecs.length
      ? refspecs.map((r) => { let d = r.includes(":") ? r.split(":").pop() : r; d = d.replace(/^refs\/heads\//, ""); return d === "HEAD" || d === "@" ? branch() : d; })
      : [branch()];
    const bad = targets.find((b) => ctx.isProtected(b));
    if (bad) deny(`no se permite 'git push' a ramas protegidas (${ctx.protectedLabel}): '${bad}'. Sube la rama feature/* y abre un PR (kit pr).`);
    return;
  }
  if (sub === "commit") {
    if (ctx.isProtected(branch())) deny(`estás en '${branch()}' (rama protegida). Crea una rama: git checkout -b feature/<nombre>`);
    const ticket = ctx.ticket();
    if (ticket) {
      const msg = commitMessage(args, dir);
      if (msg !== null && !C.commitMatchesTicket(msg, ticket))
        deny(`mensaje de commit sin la nomenclatura del equipo. Formato: "<tipo>: ${ticket} descripción" (tipo: ${C.COMMIT_TYPES.replace(/\|/g, ", ")}). Recibido: ${msg.split(/\r?\n/)[0]}`);
    }
    return;
  }
  if (sub === "checkout" || sub === "switch") {
    if (args.some((x) => ["-f", "--force", "--discard-changes"].includes(x))) deny(`'git ${sub} --force' descarta cambios locales; no permitido a los agentes.`);
    const dd = args.indexOf("--");
    const paths = dd >= 0 ? args.slice(dd + 1) : sub === "checkout" && nonFlags.length === 1 && BROAD_PATHS.has(nonFlags[0]) ? nonFlags : [];
    if (paths.some((x) => BROAD_PATHS.has(x))) deny(`'git ${sub} ${args.join(" ")}' descarta todos los cambios sin commit; no permitido a los agentes.`);
    const k = args.findIndex((x) => (sub === "checkout" ? ["-b", "-B"] : ["-c", "-C", "--create", "--force-create"]).includes(x));
    const nb = k >= 0 ? args[k + 1] : null;
    const ticket = nb ? ctx.ticket() : "";
    if (nb && ticket && /^(feature|fix|hotfix)\//i.test(nb) && !C.branchMatchesTicket(nb, ticket))
      deny(`la rama debe llevar el ticket en mayúsculas: ${nb.split("/")[0]}/${ticket}-<descripcion-corta> (ticket registrado: ${ticket}).`);
    return;
  }
  if (sub === "restore") {
    const worktree = !args.includes("--staged") && !args.includes("-S") || args.includes("--worktree") || args.includes("-W");
    if (worktree && args.some((x) => BROAD_PATHS.has(x))) deny(`'git restore ${args.join(" ")}' descarta todos los cambios sin commit; no permitido a los agentes.`);
    return;
  }
  if (sub === "reset" && args.includes("--hard")) deny("'git reset --hard' no permitido a los agentes: descarta trabajo.");
  if (sub === "clean" && !args.some((x) => x === "-n" || x === "--dry-run" || /^-[a-zA-Z]*n[a-zA-Z]*$/.test(x))) deny("'git clean' borra archivos sin versionar; no permitido a los agentes (usa --dry-run para ver qué borraría).");
  if (sub === "branch" && args.some((x) => /^(-D|-d|--delete|-f|--force|-m|-M|--move)$/.test(x))) {
    const hit = nonFlags.find((b) => ctx.isProtected(b));
    if (hit) deny(`no se permite borrar, mover ni forzar la rama protegida '${hit}'.`);
  }
  if (sub === "update-ref") { const hit = nonFlags.find((r) => ctx.isProtected(r.replace(/^refs\/heads\//, ""))); if (hit) deny(`no se permite mover la rama protegida '${hit}' con update-ref.`); }
  if (sub === "merge" && ctx.isProtected(branch())) {
    const feature = C.getState(ctx.root).feature || "";
    if (C.securityVerdict(ctx.root, feature) !== "APROBADO") deny(`merge a '${branch()}' requiere 'VEREDICTO: APROBADO' en docs/reviews/${feature}-seguridad.md`);
  }
  if (["add", "show", "diff", "log", "blame", "cat-file", "grep"].includes(sub)) {
    const s = sensitiveIn(args.filter((x) => !x.startsWith("-")));
    if (s) deny(`archivo sensible (${s}): los agentes no lo leen ni lo versionan.`);
  }
}

// Mensaje de commit a partir de los argumentos ya sin comillas: -m, -mTexto, -am, --message=, -F archivo. null = no se sabe.
function commitMessage(args, dir) {
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    let msg = null;
    if (x.startsWith("--message=")) msg = x.slice(10);
    else if (x === "--message") msg = args[i + 1];
    else if (/^-[a-zA-Z]*m$/.test(x)) msg = args[i + 1];
    else if (/^-m.+/.test(x)) msg = x.slice(2);
    else if (x === "-F" || x === "--file" || x.startsWith("--file=")) {
      const f = x.startsWith("--file=") ? x.slice(7) : args[i + 1];
      try { return fs.readFileSync(path.resolve(dir, f), "utf8"); } catch { return null; }
    }
    if (msg !== null && msg !== undefined) {
      const h = /^\s*(?:\$\(\s*)?cat\s+<<-?\s*['"]?(\w+)['"]?\s*\r?\n([\s\S]*?)\r?\n\s*\1\s*\)?\s*$/.exec(msg); // -m "$(cat <<'EOF' … EOF)"
      return h ? h[2] : msg;
    }
  }
  return null;
}

function checkSegment(seg, ctx) {
  const t = seg.t;
  const red = sensitiveIn(seg.redirs);
  if (red) deny(`archivo sensible (${red}): los agentes no lo leen ni lo escriben.`);
  if (!t.length) return;
  const p = progName(t[0]);
  if (["cd", "chdir", "set-location", "sl", "pushd", "push-location"].includes(p)) {
    const d = t.slice(1).find((x) => !/^(\/d|-path|-literalpath)$/i.test(x));
    if (d) ctx.cwd = resolveDir(ctx.cwd, d);
    return;
  }
  if (p === "git") { checkGit(parseGit(t, ctx.cwd), ctx); return; }
  if (p === "gh") {
    const k = t.indexOf("pr");
    if (k > 0 && t[k + 1] === "merge") deny("'gh pr merge' no permitido: el kit termina en el PR; el merge lo hace el equipo.");
    const r = t.indexOf("repo");
    if (r > 0 && ["delete", "archive", "rename"].includes(t[r + 1])) deny(`'gh repo ${t[r + 1]}' no permitido a los agentes.`);
    if (t[1] === "api" && t.some((x) => /\/pulls\/\d+\/merge\b|\/merges\b/.test(x))) deny("merge por la API de GitHub no permitido: el merge lo hace el equipo.");
    return;
  }
  // Borrados recursivos: sh (rm -r/-rf/-fr/--recursive), PowerShell (Remove-Item/ri/rm/del -Recurse o -r) y cmd (rd/rmdir/del /s)
  if (["rm", "remove-item", "ri", "del", "erase", "rd", "rmdir"].includes(p)) {
    const args = t.slice(1);
    if (args.some(isRecursiveFlag) || (["rd", "rmdir", "del", "erase"].includes(p) && args.some((x) => /^\/s$/i.test(x))))
      deny(`borrado recursivo no permitido a los agentes: ${t.join(" ")}`);
  }
  if (p === "find") {
    if (t.includes("-delete")) deny(`borrado con find no permitido a los agentes: ${t.join(" ")}`);
    const k = t.findIndex((x) => /^-(exec|execdir|ok)$/.test(x));
    if (k > 0) checkSegment({ t: t.slice(k + 1), redirs: [] }, ctx);
  }
  if (p === "xargs") { const k = t.findIndex((x, j) => j > 0 && !x.startsWith("-")); if (k > 0) checkSegment({ t: t.slice(k), redirs: [] }, ctx); }
  if (p === "rimraf" || (["npx", "bunx", "pnpx"].includes(p) && /^rimraf(@|$)/.test(t.find((x, j) => j > 0 && !x.startsWith("-")) || "")))
    deny(`borrado recursivo no permitido a los agentes: ${t.join(" ")}`);
  const s = sensitiveArg(p, t);
  if (s) deny(`archivo sensible (${s}): los agentes no lo leen ni lo modifican. Usa variables de entorno o el .env.example.`);
}

function protectMain(a, root, cfg) {
  for (const f of a.tool === "read" || a.tool === "edit" ? a.files : [])
    if (isSensitive(f)) deny(`archivo sensible (${f.replace(/\\/g, "/")}): los agentes no leen ni editan secretos ni claves de firma. Usa variables de entorno o el .env.example.`);
  if (a.tool !== "bash" || !a.command) return;
  const cmd = a.command;
  // Comandos del kit reservados a personas y restos de staging (kit de Claude): coincidencia sobre el texto completo.
  if (/(^|[\s"'\\/])kit(\.js)?\s+sdk\s+publish\b/.test(cmd) || /scripts[\\/]sdk\.js\s+publish\b/.test(cmd))
    deny("'kit sdk publish' (versión definitiva del SDK) lo ejecuta una persona desde su terminal, no los agentes.");
  if (/(^|[\s"'\\/])kit(\.js|\.ps1)?\s+prod\b/.test(cmd) || /promote-prod\.(js|ps1)/.test(cmd) || /scripts[\\/]prod\.js/.test(cmd))
    deny("la promoción a producción ('kit prod') solo la ejecuta una persona desde su terminal.");
  if (C.FLAVOR === "claude" && /supabase\s+(db\s+push|functions\s+deploy|db\s+reset)\b/.test(cmd))
    deny("despliegues a Supabase solo a través de 'node kit.js staging' (staging) o 'node kit.js prod' (persona).");
  if (/docker\s+system\s+prune/.test(cmd) || /docker\s+volume\s+rm/.test(cmd) || /docker\s+compose\b.*\bdown\b.*(\s-v\b|--volumes)/.test(cmd) || /\[System\.IO\.Directory\]::Delete/i.test(cmd))
    deny(`comando destructivo no permitido a los agentes: ${cmd}`);
  if (!cfg) {
    // Configuración ilegible: solo se permite diagnosticar (kit doctor/check/status y git de lectura).
    const ok = parseCommand(cmd).every(({ t }) => {
      const p = progName(t[0]);
      if (p === "kit" || (p === "node" && /kit(\.js)?$/.test(t[1] || ""))) return true;
      return p === "git" && ["status", "diff", "log", "show", "branch"].includes(parseGit(t, root).sub);
    });
    if (!ok) deny("pipeline.config.json no es JSON válido: los agentes no ejecutan comandos hasta que lo corrijas (kit doctor muestra el error).");
    cfg = C.DEFAULTS;
  }
  const ctx = makeCtx(a, root, cfg);
  for (const seg of parseCommand(cmd)) checkSegment(seg, ctx);
}

function sdkFor(root, cfg, dir) {
  try {
    const S = require("./sdk");
    for (const s of S.declared(cfg)) {
      if (S.validate(s).length) continue;
      let d; try { d = S.resolveDir(root, s).dir; } catch { continue; }
      if (isInside(dir, d)) return Object.assign({ dir: d }, s);
    }
  } catch { /* sin SDKs */ }
  return null;
}
const isInside = (child, parent) => { const r = path.relative(path.resolve(parent), path.resolve(child)); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };

function commitGate(a, root, cfg) {
  if (a.tool !== "bash" || !a.command) return;
  if (cfg.GATE_TESTS_ON_COMMIT === false || process.env.PIPELINE_SKIP_GATE === "1") return;
  // Carpetas donde se hace commit: `git commit`, `git -C dir commit`, `cd dir && git commit`…
  const ctx = { cwd: a.cwd && fs.existsSync(a.cwd) ? path.resolve(a.cwd) : root };
  const targets = [];
  for (const { t } of parseCommand(a.command)) {
    const p = progName(t[0]);
    if (["cd", "chdir", "set-location", "sl", "pushd", "push-location"].includes(p)) { const d = t.slice(1).find((x) => !/^(\/d|-path|-literalpath)$/i.test(x)); if (d) ctx.cwd = resolveDir(ctx.cwd, d); continue; }
    if (p !== "git") continue;
    const g = parseGit(t, ctx.cwd);
    if (g.sub === "commit" && !targets.includes(g.dir)) targets.push(g.dir);
  }
  const runs = new Map(); // cwd -> gates
  for (const dir of targets) {
    const s = sdkFor(root, cfg, dir);
    if (s) {
      const gates = [["Lint (SDK)", s.lint], ["Tests (SDK)", s.test]];
      if (!gates.some(([, c]) => c && String(c).trim())) { process.stdout.write(`{"type": "progress", "message": "Kit: commit en el SDK ${s.nombre} sin lint/test declarados en SDKS; compuerta omitida."}\n`); continue; }
      runs.set(s.dir, gates);
    } else if (isInside(dir, root)) {
      runs.set(root, [["Lint", cfg.LINT_CMD], ["Tests", cfg.TEST_CMD]]); // el proyecto y sus SUB_REPOS: comandos del padre
    } // otro repositorio ajeno al kit: sin compuerta
  }
  if (!runs.size) return;
  process.stdout.write('{"type": "progress", "message": "Kit: compuerta de commit (lint + tests)..."}\n');
  for (const [cwd, gates] of runs) {
    for (const [label, cmd] of gates) {
      if (!cmd || !String(cmd).trim()) continue;
      const r = C.run(cmd, { cwd, ignoreFailure: true, quiet: true });
      if (r.code !== 0) {
        const tail = r.out.split(/\r?\n/).filter(Boolean).slice(-40).join("\n");
        deny(`COMMIT BLOQUEADO: ${label} falló (${cmd}). Últimas líneas:\n${tail}`);
      }
    }
  }
}

async function sessionStart(root, a) {
  let msg;
  if (!root) {
    msg = `${C.DISPLAY_NAME} (${C.FLAVOR}) v${C.VERSION} instalado, pero no encontré pipeline.config.json desde ${a && a.cwd ? a.cwd : process.cwd()} hacia arriba. Antes de concluir que el proyecto no está inicializado, ejecuta 'kit version' en la terminal de la carpeta del repositorio (los archivos del kit están fuera de git y la búsqueda del editor no los muestra). Si de verdad no lo está: ${C.FLAVOR === "claude" ? "/multiagent-kit:init" : "/kit-init"}.`;
  } else {
    const kitJson = path.join(root, ".pipeline", "kit.json");
    const prev = C.readJson(kitJson, {});
    C.writeJson(kitJson, Object.assign({}, prev, { pluginRoot: C.PLUGIN_ROOT, flavor: C.FLAVOR, version: C.VERSION, projectFilesVersion: prev.projectFilesVersion || "", updatedAt: C.nowIso() }));
    let cfg, cfgError = "";
    try { cfg = C.loadConfig(root); } catch (e) { cfg = Object.assign({}, C.DEFAULTS); cfgError = e.message; }
    const kitCmd = fs.existsSync(path.join(root, "kit.js")) ? "node kit.js" : "kit";
    msg = C.FLAVOR === "claude"
      ? `Kit multiagente (claude) v${C.VERSION} activo. Staging: ${cfg.STAGING_PROVIDER}. Comandos del kit: ${kitCmd} <check|staging|smoke|status|state|epica|archivo|sdk|update> (iguales en Windows, macOS y Linux). Plantillas de documentos: ${kitCmd} plantilla <spec|adr|seguridad|arquitectura> (o ${path.join(C.PLUGIN_ROOT, "templates", "docs")}). Flujos: /pipeline, /analisis, /bugfix, /ideas, /deploy-staging, /promote-prod. Solo docs/ARQUITECTURA.md se commitea: specs, ADR e informes quedan fuera de git y ${kitCmd} state reset los archiva en el perfil (${kitCmd} archivo).`
      : `bkit (kit de agentes para React Native bare) v${C.VERSION} activo. El flujo termina en el PR (${kitCmd} pr). Comandos: ${kitCmd} <check|pr|status|state|epica|archivo|sdk|update> (iguales en Windows y macOS). Plantillas: ${kitCmd} plantilla <spec|adr|seguridad|arquitectura>. Flujos: /pipeline, /analisis, /bugfix, /ideas, /retro-kit. Solo docs/ARQUITECTURA.md se commitea: specs, ADR e informes quedan fuera de git.`;
    if (cfgError) msg += ` AVISO: pipeline.config.json no es JSON válido (${cfgError}); los agentes no podrán ejecutar comandos hasta corregirlo (kit doctor).`;
    if (Array.isArray(cfg.SDKS) && cfg.SDKS.length) msg += ` SDKs declarados: ${cfg.SDKS.map((s) => s && s.nombre).filter(Boolean).join(", ")} (${kitCmd} sdk list; flujo end-to-end: /pipeline --sdk <nombre> "idea").`;
    if (cfg._source === "ps1") msg += ` AVISO: pipeline.config.ps1 es el formato antiguo; ejecuta '${kitCmd} migrate'.`;
    const m = C.readJson(path.join(root, ".github", "kit-manifest.json"), null) || C.readJson(path.join(root, ".pipeline", "kit-manifest.json"), null);
    if (m && m.version && m.version !== C.VERSION) msg += ` AVISO: los archivos del proyecto son de la versión ${m.version}; ejecuta '${kitCmd} update'.`;
    if (!fs.existsSync(path.join(root, "kit.js")) && (prev.mode || "repo") !== "usuario") msg += " AVISO: falta kit.js (proyecto de una versión anterior); ejecuta la inicialización del kit.";
  }
  if (!process.env.KIT_NO_UPDATE_CHECK) {
    try {
      const R = require("./remote");
      const u = await R.checkUpdate({ timeoutMs: 3000 });
      if (u.remote && R.cmpVer(u.remote, C.VERSION) > 0) msg += ` AVISO: hay una versión nueva del plugin (${u.remote}, instalada ${C.VERSION}): ${R.updateHint()} y luego 'kit update'.`;
      if (fs.existsSync(R.lessonsPath())) msg += ` Lecciones de otros proyectos en ${R.lessonsPath()} (los agentes deben leerlas al empezar).`;
    } catch { /* sin red: no molestar */ }
  }
  // Copilot CLI lee additionalContext; VS Code, hookSpecificOutput.additionalContext (sin él, VS Code no inyecta el contexto)
  if (C.FLAVOR === "copilot") process.stdout.write(JSON.stringify({ additionalContext: msg, hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: msg } }) + "\n");
  else process.stdout.write(msg + "\n");
}

async function main() {
  const name = process.argv[2];
  const evt = readEvent();
  const a = normalize(evt);
  const root = C.findProjectRoot(a.cwd);
  if (name === "session-start") return sessionStart(root, a);
  if (!root) return; // proyectos sin kit: no interferir
  let cfg = null;
  try { cfg = C.loadConfig(root); } catch { cfg = null; }
  if (name === "protect-main") {
    try { return protectMain(a, root, cfg); } catch (e) {
      // Un error inesperado no debe abrir la puerta: se bloquean los comandos de shell (las lecturas y ediciones siguen).
      if (a.tool === "bash") deny(`error interno del hook (${e.message}); comando no evaluado. Ejecuta 'kit doctor' y avisa al mantenedor del kit.`);
      return;
    }
  }
  if (name === "commit-gate") {
    if (!cfg) return; // protect-main ya bloquea los comandos mientras la configuración no sea válida
    return commitGate(a, root, cfg);
  }
  process.stderr.write(`hook desconocido: ${name}\n`);
}

if (require.main === module) main().catch((e) => { process.stderr.write(`kit hook ${process.argv[2]}: ${e.message}\n`); process.exit(0); });
module.exports = { normalize, splitShell, parseCommand, parseGit, isSensitive, commitMessage, toolKind };
