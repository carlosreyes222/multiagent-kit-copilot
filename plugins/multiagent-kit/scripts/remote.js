// Comprobación de versión del plugin contra GitHub (caché de 24 h en ~/.multiagent-kit/) y datos del usuario
// compartidos entre proyectos y entre los dos kits (lecciones.md). Solo módulos integrados de Node.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const C = require("./common");

const REPOS = {
  claude: { repo: "carlosreyes222/multiagent-kit", file: ".claude-plugin/marketplace.json", update: "/plugin update multiagent-kit@carlos-kits  (dentro de claude)", cli: null },
  copilot: { repo: "carlosreyes222/multiagent-kit-copilot", file: "marketplace.json", update: "copilot plugin update multiagent-kit", cli: "copilot plugin update multiagent-kit" },
};
function kitHome() { return process.env.KIT_HOME || path.join(os.homedir(), ".multiagent-kit"); }
function cachePath() { return path.join(kitHome(), `version-${C.FLAVOR}.json`); }
const TTL_MS = 24 * 3600 * 1000;

function httpGet(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = require("https").get(url, { timeout: timeoutMs, headers: { "User-Agent": "multiagent-kit" } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let data = ""; res.setEncoding("utf8"); res.on("data", (c) => (data += c)); res.on("end", () => resolve(data));
    });
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });
}
function versionFromMarketplace(txt) {
  try { const m = JSON.parse(txt); const p = (m.plugins || []).find((x) => x.name === "multiagent-kit") || (m.plugins || [])[0]; return p && p.version; } catch { return null; }
}
// Versión publicada en GitHub. Repos públicos por raw.githubusercontent.com; privados a través de `gh api` si está autenticado.
async function fetchRemoteVersion(timeoutMs = 4000) {
  const r = REPOS[C.FLAVOR];
  const raw = await httpGet(`https://raw.githubusercontent.com/${r.repo}/main/${r.file}`, timeoutMs);
  let v = raw && versionFromMarketplace(raw);
  if (!v && C.which("gh")) {
    const g = C.run(`gh api repos/${r.repo}/contents/${r.file} -H "Accept: application/vnd.github.raw"`, { quiet: true, ignoreFailure: true });
    if (g.code === 0) v = versionFromMarketplace(g.out);
  }
  return v || null;
}
function cmpVer(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0), pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}
// { remote, checkedAt, fromCache, error }. Con force=true ignora la caché.
async function checkUpdate({ force = false, timeoutMs = 4000 } = {}) {
  const cache = C.readJson(cachePath(), null);
  if (!force && cache && cache.checkedAt && Date.now() - Date.parse(cache.checkedAt) < TTL_MS) return Object.assign({ fromCache: true }, cache);
  const remote = await fetchRemoteVersion(timeoutMs);
  const result = { remote, checkedAt: new Date().toISOString(), installed: C.VERSION };
  if (remote) C.writeJson(cachePath(), result); // sin respuesta no se cachea: se reintenta la próxima vez
  return Object.assign({ fromCache: false, error: remote ? null : "sin acceso a GitHub (red o repositorio privado sin gh auth)" }, result);
}
function updateHint() { return REPOS[C.FLAVOR].update; }
function updateCli() { return REPOS[C.FLAVOR].cli; }

// --- Lecciones compartidas entre proyectos (las escribe /retro-kit, las leen los agentes) ---------------------
function lessonsPath() { return path.join(kitHome(), "lecciones.md"); }
function ensureLessons() {
  const p = lessonsPath();
  if (!fs.existsSync(p)) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, "# Lecciones del kit multiagente (todos los proyectos de este PC)\n\nLas añade /retro-kit y las leen los agentes al empezar. Una por línea: `- [fecha] [stack] lección concreta y reutilizable`.\n\n", "utf8");
  }
  return p;
}

module.exports = { checkUpdate, fetchRemoteVersion, cmpVer, updateHint, updateCli, kitHome, lessonsPath, ensureLessons, REPOS };
