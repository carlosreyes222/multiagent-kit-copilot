// Núcleo compartido de los scripts del kit multiagente. Solo módulos integrados de Node (>= 18):
// funciona igual en Windows, macOS y Linux sin instalar nada más.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const IS_WIN = process.platform === "win32";
const OS_NAME = IS_WIN ? "windows" : process.platform === "darwin" ? "macos" : "linux";
const PLUGIN_ROOT = path.resolve(__dirname, "..");

// --- Sabor del kit (Claude Code o GitHub Copilot) y versión ---------------------------------
function pluginManifest() {
  for (const rel of ["plugin.json", ".claude-plugin/plugin.json"]) {
    const p = path.join(PLUGIN_ROOT, rel);
    if (fs.existsSync(p)) return { path: p, data: JSON.parse(fs.readFileSync(p, "utf8")), flavor: rel === "plugin.json" ? "copilot" : "claude" };
  }
  throw new Error("No encuentro plugin.json en " + PLUGIN_ROOT);
}
const MANIFEST = pluginManifest();
const FLAVOR = MANIFEST.flavor; // "claude" | "copilot"
const VERSION = MANIFEST.data.version;
const CONTEXT_FILE = FLAVOR === "claude" ? "CLAUDE.md" : "AGENTS.md";

// --- Salida ----------------------------------------------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const log = {
  step: (m) => console.log("\n" + c(36, "==> " + m)),
  ok: (m) => console.log("    " + c(32, "[OK] " + m)),
  warn: (m) => console.log("    " + c(33, "[!!] " + m)),
  fail: (m) => console.log("    " + c(31, "[XX] " + m)),
  plain: (m) => console.log("    " + m),
  green: (m) => console.log(c(32, m)),
  red: (m) => console.log(c(31, m)),
  yellow: (m) => console.log(c(33, m)),
  cyan: (m) => console.log(c(36, m)),
};

// --- Raíz del proyecto -----------------------------------------------------------------------
function isProjectRoot(d) {
  return d && (fs.existsSync(path.join(d, "pipeline.config.json")) || fs.existsSync(path.join(d, "pipeline.config.ps1")));
}
function findProjectRoot(start) {
  const cands = [process.env.KIT_PROJECT_DIR, process.env.CLAUDE_PROJECT_DIR, start, process.cwd()].filter(Boolean);
  for (const cnd of cands) {
    let d = path.resolve(cnd);
    for (;;) {
      if (isProjectRoot(d)) return d;
      const parent = path.dirname(d);
      if (parent === d) break;
      d = parent;
    }
  }
  return null;
}
function requireProjectRoot() {
  const r = findProjectRoot();
  if (!r) throw new Error("No encuentro pipeline.config.json. Ejecuta esto desde la raíz de un proyecto inicializado (node kit.js init).");
  return r;
}

// --- Configuración del proyecto ---------------------------------------------------------------
const DEFAULTS = {
  INSTALL_CMD: "", BUILD_CMD: "", TEST_CMD: "", LINT_CMD: "", TEST_DB_CMD: "",
  STAGING_PROVIDER: "docker", APP_NAME: "mi-app", STAGING_URL: "", HEALTH_PATH: "/health", SMOKE_CMD: "",
  STAGING_ENV_FILE: "staging/.env.staging", STAGING_PORT: 8080, BASE_IMAGE: "alpine:3.20",
  CONTAINER_CMD: "sh -c 'echo listo && sleep infinity'", STAGING_COMPOSE_FILE: "staging/docker-compose.staging.yml",
  SUPABASE_STAGING_REF: "", SUPABASE_PROD_REF: "", SUPABASE_DIR: ".", SUPABASE_FUNCTIONS: [], SUPABASE_NO_VERIFY_JWT: true,
  STAGING_DEPLOY_CMD: "", PROD_DEPLOY_CMD: "", SUB_REPOS: [],
  PROTECTED_BRANCHES: FLAVOR === "copilot" ? ["main", "master", "develop", "release"] : ["main", "master", "produccion", "release"],
  GATE_TESTS_ON_COMMIT: true, MAX_LINES_ARQUITECTURA: 300, MAX_LINES_INFORME: 100, MAX_LINES_ADR: 150,
  SDKS: [],
};

// Lee un pipeline.config.ps1 antiguo (solo asignaciones simples) para migrar o para compatibilidad.
function parseLegacyPs1(text) {
  const out = {};
  const re = /^\s*\$([A-Z_]+)\s*=\s*(.+?)\s*(?:#.*)?$/gm;
  let m;
  while ((m = re.exec(text))) {
    const key = m[1];
    let raw = m[2].trim();
    // quitar comentario final fuera de comillas
    let val;
    if (raw.startsWith("@(")) {
      const inner = raw.slice(2, raw.lastIndexOf(")"));
      val = inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else if (/^\$true$/i.test(raw)) val = true;
    else if (/^\$false$/i.test(raw)) val = false;
    else if (/^-?\d+$/.test(raw)) val = parseInt(raw, 10);
    else if (/^"/.test(raw)) val = raw.slice(1, raw.indexOf('"', 1) < 0 ? undefined : raw.lastIndexOf('"')).replace(/`"/g, '"');
    else if (/^'/.test(raw)) val = raw.slice(1, raw.lastIndexOf("'"));
    else val = raw;
    if (typeof val === "string") val = val.replace(/\s+#.*$/, "");
    out[key] = val;
  }
  return out;
}

function loadConfig(root) {
  const jsonPath = path.join(root, "pipeline.config.json");
  const ps1Path = path.join(root, "pipeline.config.ps1");
  let data = {}, source = null;
  if (fs.existsSync(jsonPath)) {
    try { data = JSON.parse(fs.readFileSync(jsonPath, "utf8").replace(/^﻿/, "")); } catch (e) { throw new Error(`pipeline.config.json no es JSON válido: ${e.message}`); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("pipeline.config.json debe ser un objeto JSON { … }");
    source = "json";
  } else if (fs.existsSync(ps1Path)) {
    data = parseLegacyPs1(fs.readFileSync(ps1Path, "utf8"));
    source = "ps1";
  }
  const cfg = Object.assign({}, DEFAULTS);
  for (const k of Object.keys(data)) if (!k.startsWith("_")) cfg[k] = data[k];
  if (!cfg.STAGING_URL && cfg.STAGING_PORT && ["docker", "compose"].includes(cfg.STAGING_PROVIDER)) cfg.STAGING_URL = `http://localhost:${cfg.STAGING_PORT}`;
  cfg._source = source;
  return cfg;
}

// --- Estado del pipeline (.pipeline/state.json), esquema v2 ------------------------------------
// Varios agentes escriben a la vez (revisor-codigo y revisor-seguridad van en paralelo): cada escritura toma un lock
// (.pipeline/state.json.lock), relee, fusiona y reemplaza el archivo de forma atómica (temporal + rename).
const STATE_KEYS = ["feature", "type", "mode", "stage", "qa", "codigo", "seguridad", "qa_iter", "codigo_iter", "staging_ok", "smoke_ok", "staging_at", "promoted_at", "promoted_tag", "started_at", "sdk", "sdk_version", "tamano", "compuertas", "ticket", "epica", "pr_base", "pr_estado", "pr_url"];
const VERDICT = ["PENDIENTE", "APROBADO", "RECHAZADO"];
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const STATE_RULES = {
  feature: (v) => v === "" || (SLUG_RE.test(v) && !v.includes("..")) || "un slug sin espacios ni barras (p. ej. ABC-123-login-biometrico)",
  epica: (v) => v === "" || (SLUG_RE.test(v) && !v.includes("..")) || "un nombre de épica sin espacios ni barras",
  type: ["feature", "bugfix"], mode: ["nuevo", "existente"],
  stage: ["", "spec", "arquitectura", "implementacion", "qa", "revisiones", "pr", "staging", "documentacion", "entrega", "reproducir", "corregir"],
  qa: VERDICT, codigo: VERDICT, seguridad: VERDICT,
  qa_iter: (v) => Number.isInteger(v) && v >= 0 || "un entero ≥ 0", codigo_iter: (v) => Number.isInteger(v) && v >= 0 || "un entero ≥ 0",
  staging_ok: [true, false], smoke_ok: [true, false],
  tamano: ["", "S", "M", "L"], compuertas: ["", "completas", "reducidas"],
  ticket: (v) => v === "" || /^[A-Za-z][A-Za-z0-9]{1,14}-\d{1,7}$/.test(v) || "un ticket tipo ABC-123",
  pr_estado: ["", "creado", "rama_subida", "rama_local"],
  pr_base: (v) => v === "" || (/^[^\s~^:?*[\\]+$/.test(v) && !v.includes("..")) || "un nombre de rama git válido",
};
// Devuelve null si el valor es válido o el motivo si no lo es.
function stateValueError(k, v) {
  const rule = STATE_RULES[k];
  if (!rule) return null;
  if (Array.isArray(rule)) return rule.includes(v) ? null : `valores permitidos: ${rule.map((x) => (x === "" ? '""' : x)).join(" | ")}`;
  const r = rule(v);
  return r === true ? null : r;
}
function stateFile(root) { return path.join(root, ".pipeline", "state.json"); }
function defaultState() {
  const s = { schema_version: 2, feature: "", type: "feature", stage: "", qa: "PENDIENTE", codigo: "PENDIENTE", seguridad: "PENDIENTE" };
  return FLAVOR === "claude" ? Object.assign(s, { staging_ok: false, smoke_ok: false, staging_at: "" }) : s;
}
function sleepMs(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function getState(root) {
  const f = stateFile(root);
  let txt = null;
  for (let i = 0; i < 5; i++) {
    try { txt = fs.readFileSync(f, "utf8"); break; } catch (e) { if (e.code === "ENOENT") break; sleepMs(20); } // EBUSY en Windows durante un rename
  }
  if (txt !== null) {
    try { return JSON.parse(txt); } catch {
      // Corrupto: se aparta (no se pierde) y se sigue con un estado limpio.
      const bak = `${f}.corrupto-${Date.now()}`;
      try { fs.renameSync(f, bak); process.stderr.write(`AVISO: .pipeline/state.json estaba corrupto; lo guardé como ${path.basename(bak)} y el estado empieza de cero.\n`); } catch { /* otro proceso lo apartó */ }
    }
  }
  return defaultState();
}
function writeFileAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; } catch (e) {
      if (i >= 40 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) { try { fs.unlinkSync(tmp); } catch { /* ya no está */ } throw e; }
      sleepMs(25); // Windows: el destino está abierto por un lector
    }
  }
}
function withStateLock(root, fn) {
  const lock = stateFile(root) + ".lock";
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const deadline = Date.now() + 15000;
  let fd;
  for (;;) {
    try { fd = fs.openSync(lock, "wx"); break; } catch (e) {
      if (e.code !== "EEXIST" && e.code !== "EPERM") throw e;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 30000) { fs.unlinkSync(lock); continue; } } catch { continue; } // lock huérfano
      if (Date.now() > deadline) throw new Error(`El estado está bloqueado por otro proceso (${lock}). Si ningún agente está trabajando, borra ese archivo.`);
      sleepMs(15 + Math.floor(Math.random() * 35));
    }
  }
  try { fs.writeSync(fd, String(process.pid)); return fn(); }
  finally { try { fs.closeSync(fd); } catch { /* cerrado */ } try { fs.unlinkSync(lock); } catch { /* ya no está */ } }
}
function setState(root, changes) {
  return withStateLock(root, () => {
    const s = getState(root);
    if (!s.schema_version) s.schema_version = 2;
    Object.assign(s, changes);
    writeFileAtomic(stateFile(root), JSON.stringify(s, null, 2) + "\n");
    return s;
  });
}
// Cierra la feature: archiva el estado en .pipeline/historial.jsonl y deja uno limpio. Devuelve el anterior.
function resetState(root) {
  return withStateLock(root, () => {
    const prev = getState(root);
    if (prev.feature) fs.appendFileSync(path.join(root, ".pipeline", "historial.jsonl"), JSON.stringify(Object.assign({ cerrado_at: nowIso() }, prev)) + "\n", "utf8");
    writeFileAtomic(stateFile(root), JSON.stringify(defaultState(), null, 2) + "\n");
    return prev;
  });
}
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "");

// --- Ejecución de comandos ---------------------------------------------------------------------
// Ejecuta un comando en el shell del sistema (cmd en Windows, sh en el resto), mostrando su salida.
function run(cmdline, { cwd, ignoreFailure = false, env, quiet = false } = {}) {
  const r = spawnSync(cmdline, { cwd, env: Object.assign({}, process.env, env || {}), shell: true, encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
  const out = (r.stdout || "") + (r.stderr || "");
  if (!quiet) for (const line of out.split(/\r?\n/)) if (line.trim()) console.log("    " + line);
  const code = r.status == null ? 1 : r.status;
  if (code !== 0 && !ignoreFailure) throw new Error(`Falló (${code}): ${cmdline}`);
  return { code, out };
}
function runProjectCmd(root, label, cmd, env) {
  if (!cmd || !String(cmd).trim()) { log.warn(`${label} omitido (vacío en pipeline.config.json)`); return; }
  log.step(`${label} : ${cmd}`);
  run(cmd, { cwd: root, env });
  log.ok(label);
}
function currentBranch(root) {
  const r = spawnSync("git", ["-C", root, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  if (r.status !== 0) return "";
  const b = (r.stdout || "").trim();
  return b === "HEAD" ? "" : b;
}
// Ramas protegidas: nombres exactos o con comodín * (p. ej. "release_*"). Devuelve una función rama -> boolean.
function protectedMatcher(list) {
  const parts = (Array.isArray(list) ? list : []).filter(Boolean).map((b) => String(b).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"));
  const re = parts.length ? new RegExp(`^(${parts.join("|")})$`) : null;
  return (b) => !!(b && re && re.test(b));
}
function which(bin) {
  const r = spawnSync(IS_WIN ? "where" : "which", [bin], { encoding: "utf8" });
  return r.status === 0;
}

// --- HTTP: espera a que una URL responda 200 --------------------------------------------------
function httpStatus(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const mod = url.startsWith("https:") ? require("https") : require("http");
    const req = mod.get(url, { timeout: timeoutMs }, (res) => { res.resume(); resolve(res.statusCode || 0); });
    req.on("timeout", () => { req.destroy(); resolve(0); });
    req.on("error", () => resolve(0));
  });
}
async function waitHealthy(url, seconds = 60) {
  log.step(`Esperando a que ${url} responda 200 (máx. ${seconds} s)`);
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if ((await httpStatus(url)) === 200) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

// --- Compuertas ----------------------------------------------------------------------------------
// Veredicto de un informe: líneas "CLAVE: APROBADO|RECHAZADO" (admite **negrita** y texto detrás). Si el informe
// tiene veredictos distintos (p. ej. quedó el RECHAZADO de la plantilla o de una iteración anterior) es CONTRADICTORIO:
// no cuenta como aprobado hasta que quede uno solo.
function textVerdict(txt, key) {
  const re = new RegExp(`^[ \\t]*[*_>-]*[ \\t]*${key}:[ \\t]*[*_]*[ \\t]*(APROBADO|RECHAZADO)\\b`, "gm");
  const found = new Set();
  let m;
  while ((m = re.exec(String(txt || "")))) found.add(m[1]);
  if (!found.size) return "PENDIENTE";
  return found.size > 1 ? "CONTRADICTORIO" : [...found][0];
}
function reportVerdict(file, key) { return fs.existsSync(file) ? textVerdict(fs.readFileSync(file, "utf8"), key) : "PENDIENTE"; }
// Commit revisado que declara el informe ("COMMIT: <sha>"), o "" si no lo declara.
function reportCommit(file) {
  if (!fs.existsSync(file)) return "";
  const m = /^[ \t]*[*_>-]*[ \t]*COMMIT:[ \t]*[*_`]*[ \t]*([0-9a-f]{7,40})\b/im.exec(fs.readFileSync(file, "utf8"));
  return m ? m[1].toLowerCase() : "";
}
function securityVerdict(root, feature) {
  if (!feature) return "PENDIENTE";
  return reportVerdict(path.join(root, "docs", "reviews", `${feature}-seguridad.md`), "VEREDICTO");
}
function docLimits(root, cfg) {
  const checks = [
    { p: "docs/ARQUITECTURA.md", max: cfg.MAX_LINES_ARQUITECTURA },
    { p: "docs/arquitectura.md", max: cfg.MAX_LINES_ARQUITECTURA },
  ];
  for (const [dir, max] of [["docs/reviews", cfg.MAX_LINES_INFORME], ["docs/adr", cfg.MAX_LINES_ADR]]) {
    const d = path.join(root, dir);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (f.endsWith(".md")) checks.push({ p: `${dir}/${f}`, max });
  }
  const over = [];
  for (const ch of checks) {
    const full = path.join(root, ch.p);
    if (!fs.existsSync(full) || /_PLANTILLA/.test(ch.p)) continue;
    const n = fs.readFileSync(full, "utf8").split(/\r?\n/).length;
    if (n > ch.max) over.push(`${ch.p}: ${n} líneas (máx. ${ch.max})`);
  }
  return over;
}

// --- Supabase: db push + functions deploy contra un proyecto. Nunca por navegador. -----------------
function supabaseDeploy(root, cfg, projectRef, label) {
  const dir = path.join(root, cfg.SUPABASE_DIR || ".");
  if (!fs.existsSync(path.join(dir, "supabase"))) throw new Error(`No existe ${cfg.SUPABASE_DIR}/supabase. Ajusta SUPABASE_DIR en pipeline.config.json.`);
  log.step(`Supabase (${label}): proyecto ${projectRef}`);
  try {
    run("supabase --version", { cwd: dir, quiet: true });
    run(`supabase link --project-ref ${projectRef}`, { cwd: dir });
    log.step("Migraciones: supabase db push");
    run("supabase db push", { cwd: dir });
    let fns = Array.isArray(cfg.SUPABASE_FUNCTIONS) ? cfg.SUPABASE_FUNCTIONS : [];
    const fdir = path.join(dir, "supabase", "functions");
    if (fns.length === 0 && fs.existsSync(fdir)) fns = fs.readdirSync(fdir).filter((n) => !n.startsWith("_") && fs.statSync(path.join(fdir, n)).isDirectory());
    for (const fn of fns) {
      const flag = cfg.SUPABASE_NO_VERIFY_JWT ? "--no-verify-jwt" : "";
      log.step(`Edge Function: ${fn}`);
      run(`supabase functions deploy ${fn} ${flag} --project-ref ${projectRef}`, { cwd: dir });
    }
    log.ok(`Supabase (${label}) desplegado: migraciones + ${fns.length} funciones`);
    return true;
  } catch (e) {
    log.fail(e.message);
    return false;
  }
}

// --- Plantillas de documentos: la del proyecto si existe (docs/...), si no la del plugin (templates/docs/...) ---------
const TEMPLATES = { spec: "docs/specs/_PLANTILLA.md", adr: "docs/adr/_PLANTILLA.md", seguridad: "docs/reviews/_PLANTILLA-seguridad.md", arquitectura: "docs/_PLANTILLA-ARQUITECTURA.md" };
function templatePath(root, kind) {
  const rel = TEMPLATES[kind];
  if (!rel) return null;
  const local = root ? path.join(root, rel) : null;
  if (local && fs.existsSync(local)) return local;
  return path.join(PLUGIN_ROOT, "templates", rel);
}

// --- Ticket de Jira en ramas y commits -----------------------------------------------------------------
// Detecta un ticket tipo ABC-123 (cualquier mayúscula/minúscula) en un texto; devuelve { ticket: "ABC-123", rest }.
const TICKET_RE = /(?:^|[\s(\[:#])([A-Za-z][A-Za-z0-9]{1,14}-\d{1,7})(?=$|[\s)\]:,.])/;
function parseTicket(text) {
  const m = TICKET_RE.exec(String(text || ""));
  if (!m) return { ticket: "", rest: String(text || "").trim() };
  return { ticket: m[1].toUpperCase(), rest: String(text).replace(m[1], " ").replace(/\s+/g, " ").trim() };
}
const COMMIT_TYPES = "feat|fix|chore|docs|test|refactor|perf|build|ci|style|revert";
// Mensaje de commit válido con ticket: "feat: ABC-123 descripción" (también feat(scope): ABC-123 …)
function commitMatchesTicket(msg, ticket) { return new RegExp(`^(${COMMIT_TYPES})(\\([^)]*\\))?!?:\\s*${ticket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(String(msg || "").trim()); }
function branchMatchesTicket(branch, ticket) { return new RegExp(`^(feature|fix|hotfix)/${ticket}(-|$)`, "i").test(branch) && /^(feature|fix|hotfix)\/[A-Z0-9]+-\d+/.test(branch); }

// --- Utilidades ------------------------------------------------------------------------------------
// Hash de un archivo. Los de texto se normalizan a LF: git en Windows (autocrlf) convierte a CRLF y no debe contar como "modificado".
function sha256(file) {
  let buf = fs.readFileSync(file);
  if (!buf.includes(0)) buf = Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  return require("crypto").createHash("sha256").update(buf).digest("hex");
}
function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; } }
function writeJson(p, data) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8"); }
function parseArgs(argv) {
  // --feature x  --yes  clave=valor ...
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--") && !next.includes("=")) { opts[k] = next; i++; } else opts[k] = true;
    } else opts._.push(a);
  }
  return opts;
}

module.exports = {
  IS_WIN, OS_NAME, PLUGIN_ROOT, FLAVOR, VERSION, CONTEXT_FILE, MANIFEST, DEFAULTS, STATE_KEYS,
  log, findProjectRoot, requireProjectRoot, loadConfig, stateFile, parseLegacyPs1, getState, setState, resetState, defaultState, stateValueError, withStateLock, writeFileAtomic, nowIso,
  run, runProjectCmd, currentBranch, protectedMatcher, which, httpStatus, waitHealthy, securityVerdict, textVerdict, reportVerdict, reportCommit, docLimits, supabaseDeploy,
  sha256, readJson, writeJson, parseArgs, homeDir: os.homedir, parseTicket, commitMatchesTicket, branchMatchesTicket, COMMIT_TYPES, TEMPLATES, templatePath,
};
