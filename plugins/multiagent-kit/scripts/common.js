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
  STAGING_DEPLOY_CMD: "", PROD_DEPLOY_CMD: "", SUB_REPOS: [], PROTECTED_BRANCHES: ["main", "master", "produccion", "release"],
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
    data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
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
const STATE_KEYS = ["feature", "type", "mode", "stage", "qa", "codigo", "seguridad", "qa_iter", "codigo_iter", "staging_ok", "smoke_ok", "staging_at", "promoted_at", "promoted_tag", "started_at", "sdk", "sdk_version"];
function stateFile(root) { return path.join(root, ".pipeline", "state.json"); }
function getState(root) {
  const f = stateFile(root);
  if (fs.existsSync(f)) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { /* corrupto: se regenera */ } }
  return { schema_version: 2, feature: "", type: "feature", stage: "", qa: "PENDIENTE", codigo: "PENDIENTE", seguridad: "PENDIENTE", staging_ok: false, smoke_ok: false, staging_at: "" };
}
function setState(root, changes) {
  const s = getState(root);
  if (!s.schema_version) s.schema_version = 2;
  Object.assign(s, changes);
  fs.mkdirSync(path.dirname(stateFile(root)), { recursive: true });
  fs.writeFileSync(stateFile(root), JSON.stringify(s, null, 2) + "\n", "utf8");
  return s;
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
function securityVerdict(root, feature) {
  if (!feature) return "PENDIENTE";
  const f = path.join(root, "docs", "reviews", `${feature}-seguridad.md`);
  if (!fs.existsSync(f)) return "PENDIENTE";
  const txt = fs.readFileSync(f, "utf8");
  if (/^\s*VEREDICTO:\s*APROBADO/m.test(txt)) return "APROBADO";
  if (/^\s*VEREDICTO:\s*RECHAZADO/m.test(txt)) return "RECHAZADO";
  return "PENDIENTE";
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
  log, findProjectRoot, requireProjectRoot, loadConfig, parseLegacyPs1, getState, setState, nowIso,
  run, runProjectCmd, currentBranch, which, httpStatus, waitHealthy, securityVerdict, docLimits, supabaseDeploy,
  sha256, readJson, writeJson, parseArgs, homeDir: os.homedir,
};
