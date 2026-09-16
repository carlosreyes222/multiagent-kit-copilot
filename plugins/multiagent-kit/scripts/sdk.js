// SDKs externos del proyecto: código del equipo que el proyecto padre consume como dependencia (npm, Android/Maven, iOS).
// Se declaran en pipeline.config.json → "SDKS". Uso:
//   node kit.js sdk list                          -> SDKs declarados y dónde están
//   node kit.js sdk sync [nombre|--all] [--rama x] -> localiza el SDK (ruta local) o lo clona/actualiza desde GitHub en .pipeline/sdks/<nombre>
//   node kit.js sdk pack <nombre> [--feature s]   -> versión de trabajo X.Y.Z-local.N, build, publicar en local y actualizar la dependencia del padre
//   node kit.js sdk status                        -> qué versión de trabajo tiene enlazada el padre de cada SDK
// Nunca publica en un registro remoto ni hace push: la versión -local.N vive solo en este PC y en vendor/sdks/ (npm).
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./common");

const TYPES = ["npm", "android", "ios", "comando"];
const q = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- Registro local (.pipeline/sdks.json) ---------------------------------------------------------
function registryPath(root) { return path.join(root, ".pipeline", "sdks.json"); }
function getRegistry(root) { return C.readJson(registryPath(root), { schema_version: 1, sdks: {} }); }
function setRegistry(root, reg) { C.writeJson(registryPath(root), reg); }
function record(root, name, changes) {
  const reg = getRegistry(root);
  reg.sdks[name] = Object.assign({}, reg.sdks[name] || {}, changes, { updatedAt: C.nowIso() });
  setRegistry(root, reg);
  return reg.sdks[name];
}

// --- Declaración y resolución -----------------------------------------------------------------------
function declared(cfg) {
  const list = Array.isArray(cfg.SDKS) ? cfg.SDKS : [];
  return list.filter((s) => s && typeof s === "object");
}
function validate(s) {
  const errs = [];
  if (!s.nombre || !/^[a-z0-9][a-z0-9._-]*$/i.test(s.nombre)) errs.push("'nombre' obligatorio (letras, números, - _ .)");
  if (!TYPES.includes(s.tipo)) errs.push(`'tipo' debe ser uno de: ${TYPES.join(", ")}`);
  if (!s.ruta && !s.repo) errs.push("indica 'ruta' (carpeta local) o 'repo' (URL git)");
  if (["npm", "android", "ios"].includes(s.tipo) && !s.paquete) errs.push("'paquete' obligatorio (npm: nombre del paquete; android: grupo:artefacto; ios: nombre del pod o del paquete Swift)");
  if (s.tipo === "comando" && !s.publicar) errs.push("tipo 'comando' requiere 'publicar' (y normalmente 'enlazar')");
  return errs;
}
function find(cfg, name) {
  const s = declared(cfg).find((x) => x.nombre === name);
  if (!s) throw new Error(`SDK '${name}' no está declarado en pipeline.config.json → SDKS. Declarados: ${declared(cfg).map((x) => x.nombre).join(", ") || "(ninguno)"}`);
  const errs = validate(s);
  if (errs.length) throw new Error(`SDK '${name}' mal declarado: ${errs.join("; ")}`);
  return s;
}
// Carpeta del SDK: la ruta local si se declaró y existe; si no, el clon en .pipeline/sdks/<nombre>.
function resolveDir(root, s) {
  if (s.ruta) {
    const d = path.resolve(root, s.ruta);
    if (fs.existsSync(d)) return { dir: d, origin: "ruta" };
    if (!s.repo) throw new Error(`SDK '${s.nombre}': la ruta ${d} no existe y no hay 'repo' del que clonarlo.`);
    C.log.warn(`SDK '${s.nombre}': la ruta ${d} no existe; uso el clon de ${s.repo}.`);
  }
  return { dir: path.join(root, ".pipeline", "sdks", s.nombre), origin: "repo" };
}
function git(dir, args, opts = {}) {
  return C.run(`git -C ${q(dir)} ${args}`, Object.assign({ quiet: true, ignoreFailure: true }, opts));
}

// --- sync ---------------------------------------------------------------------------------------------
function sync(root, s, ramaOpt) {
  const { dir, origin } = resolveDir(root, s);
  const rama = ramaOpt || s.rama || "main";
  C.log.step(`SDK ${s.nombre} (${s.tipo}) · ${origin === "ruta" ? "carpeta local" : "clon de " + s.repo} · rama ${rama}`);
  if (origin === "repo") {
    if (!fs.existsSync(path.join(dir, ".git"))) {
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      C.log.plain(`Clonando en ${path.relative(root, dir)} …`);
      C.run(`git clone --branch ${q(rama)} ${q(s.repo)} ${q(dir)}`, { quiet: true });
    } else {
      const dirty = git(dir, "status --porcelain").out.trim();
      if (dirty) {
        C.log.warn(`El clon tiene cambios sin commit (probablemente una feature en curso). No cambio de rama ni hago pull.`);
      } else {
        git(dir, "fetch --prune origin", { quiet: true });
        const cur = C.currentBranch(dir);
        if (cur !== rama) {
          const r = git(dir, `checkout ${q(rama)}`);
          if (r.code !== 0) { const r2 = git(dir, `checkout -b ${q(rama)} --track origin/${q(rama)}`); if (r2.code !== 0) throw new Error(`No pude cambiar a la rama ${rama}: ${r2.out.trim()}`); }
        }
        const p = git(dir, `pull --ff-only origin ${q(rama)}`);
        if (p.code !== 0) C.log.warn(`pull --ff-only falló (${p.out.trim().split(/\r?\n/).pop()}); sigo con lo que hay en local.`);
      }
    }
  } else if (!fs.existsSync(path.join(dir, ".git"))) {
    C.log.warn("La carpeta no es un repositorio git: los hooks de ramas protegidas no aplican dentro del SDK.");
  }
  const branch = C.currentBranch(dir) || "(sin rama)";
  const commit = git(dir, "rev-parse --short HEAD").out.trim() || "";
  const version = readVersion(s, dir).version || "";
  record(root, s.nombre, { tipo: s.tipo, paquete: s.paquete || "", dir, origin, rama, branch, commit, version });
  C.log.ok(`${path.relative(root, dir) || "."}  ·  rama ${branch}  ·  ${commit}${version ? "  ·  v" + version : ""}`);
  return dir;
}

// --- Versión del SDK (leer y fijar temporalmente) ---------------------------------------------------------
function readVersion(s, dir) {
  if (s.tipo === "npm") {
    const p = path.join(dir, "package.json"); const pkg = C.readJson(p, null);
    return pkg ? { version: pkg.version || "", file: p } : {};
  }
  if (s.tipo === "android") {
    for (const f of ["gradle.properties"]) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) { const m = /^\s*(VERSION_NAME|version|VERSION)\s*=\s*(.+?)\s*$/m.exec(fs.readFileSync(p, "utf8")); if (m) return { version: m[2], file: p, key: m[1] }; }
    }
    for (const f of ["build.gradle.kts", "build.gradle", path.join(s.modulo || "lib", "build.gradle.kts"), path.join(s.modulo || "lib", "build.gradle")]) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) { const m = /^\s*version\s*=\s*["']([^"']+)["']/m.exec(fs.readFileSync(p, "utf8")); if (m) return { version: m[1], file: p }; }
    }
    return {};
  }
  if (s.tipo === "ios") {
    const spec = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => f.endsWith(".podspec")) : null;
    if (spec) { const m = /\.version\s*=\s*["']([^"']+)["']/.exec(fs.readFileSync(path.join(dir, spec), "utf8")); if (m) return { version: m[1], file: path.join(dir, spec) }; }
    return {};
  }
  return {};
}
function nextLocalVersion(root, s, current) {
  const base = (current || "0.0.0").replace(/-local\.\d+$/, "");
  const prev = getRegistry(root).sdks[s.nombre] || {};
  const n = (prev.local_n || 0) + 1;
  return { version: `${base}-local.${n}`, n, base };
}
// Cambia la versión en el archivo del SDK y devuelve una función para restaurarlo (la versión de trabajo no se commitea).
function setVersionTemp(s, info, version) {
  if (!info.file) return () => {};
  const original = fs.readFileSync(info.file, "utf8");
  let txt = original;
  if (s.tipo === "npm") { const pkg = JSON.parse(original); pkg.version = version; txt = JSON.stringify(pkg, null, 2) + "\n"; }
  else if (info.key) txt = original.replace(new RegExp(`^(\\s*${info.key}\\s*=\\s*).+$`, "m"), `$1${version}`);
  else txt = original.replace(/^(\s*version\s*=\s*["'])[^"']+(["'])/m, `$1${version}$2`);
  fs.writeFileSync(info.file, txt, "utf8");
  return () => fs.writeFileSync(info.file, original, "utf8");
}

// --- Empaquetar por tipo ----------------------------------------------------------------------------------
function detectPm(dir) {
  if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock"))) return "bun";
  return "npm";
}
// package.json del padre que declara el paquete (raíz, 'destino' o búsqueda en workspaces hasta 3 niveles).
function findPackageJsons(root, s) {
  if (s.destino) return [path.resolve(root, s.destino)];
  const out = [];
  const walk = (d, depth) => {
    const pj = path.join(d, "package.json");
    if (fs.existsSync(pj)) { const pkg = C.readJson(pj, {}); for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) if (pkg[k] && pkg[k][s.paquete]) { out.push(pj); break; } }
    if (depth <= 0) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || ["node_modules", ".git", ".pipeline", "vendor", "dist", "build"].includes(e.name) || e.name.startsWith(".")) continue;
      walk(path.join(d, e.name), depth - 1);
    }
  };
  walk(root, 3);
  return out.length ? out : [path.join(root, "package.json")];
}
function ensureNotIgnored(root, relFile) {
  const r = git(root, `check-ignore -q ${q(relFile)}`);
  if (r.code !== 0) return;
  const gi = path.join(root, ".gitignore");
  const line = `!${relFile.replace(/[^/]+$/, "*.tgz")}`;
  fs.appendFileSync(gi, `\n# multiagent-kit: los paquetes locales de SDKs se versionan\n${line}\n`, "utf8");
  C.log.warn(`${relFile} estaba ignorado por .gitignore; añadí '${line}' para que se versione.`);
}

function packNpm(root, s, dir, version) {
  const pm = detectPm(dir);
  const pkg = C.readJson(path.join(dir, "package.json"), {});
  if (s.build) C.run(s.build, { cwd: dir });
  else if (pkg.scripts && pkg.scripts.build) C.run(`${pm} run build`, { cwd: dir });
  else C.log.warn("El SDK no tiene script 'build' ni 'build' en la config: empaqueto tal cual.");
  const vendor = path.join(root, "vendor", "sdks");
  fs.mkdirSync(vendor, { recursive: true });
  const fname = `${String(pkg.name || s.paquete).replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;
  C.log.step(`npm pack → vendor/sdks/${fname}`);
  C.run(`npm pack --pack-destination ${q(vendor)}`, { cwd: dir, quiet: true });
  if (!fs.existsSync(path.join(vendor, fname))) throw new Error(`npm pack no produjo ${fname}`);
  // limpiar versiones -local anteriores del mismo paquete
  const prefix = fname.replace(/-\d+\.\d+\.\d+.*\.tgz$/, "-");
  for (const f of fs.readdirSync(vendor)) if (f !== fname && f.startsWith(prefix) && /-local\.\d+\.tgz$/.test(f)) fs.unlinkSync(path.join(vendor, f));
  ensureNotIgnored(root, `vendor/sdks/${fname}`);
  const touched = [];
  for (const pj of findPackageJsons(root, s)) {
    const p = C.readJson(pj, null);
    if (!p) continue;
    const rel = path.relative(path.dirname(pj), path.join(vendor, fname)).replace(/\\/g, "/");
    let hit = false;
    for (const k of ["dependencies", "devDependencies", "optionalDependencies"]) if (p[k] && p[k][s.paquete]) { p[k][s.paquete] = `file:${rel}`; hit = true; }
    if (!hit) { p.dependencies = p.dependencies || {}; p.dependencies[s.paquete] = `file:${rel}`; }
    fs.writeFileSync(pj, JSON.stringify(p, null, 2) + "\n", "utf8");
    touched.push(pj);
    C.log.ok(`${path.relative(root, pj)}: "${s.paquete}": "file:${rel}"`);
  }
  const ppm = detectPm(root);
  C.log.step(`${ppm} install (padre)`);
  C.run(`${ppm} install`, { cwd: root });
  return { artefacto: path.relative(root, path.join(vendor, fname)).replace(/\\/g, "/"), archivos: touched.map((t) => path.relative(root, t)) };
}

function gradlew(dir) { return C.IS_WIN ? "gradlew.bat" : "./gradlew"; }
function packAndroid(root, s, dir, version) {
  if (s.build) C.run(s.build, { cwd: dir });
  const cmd = s.publicar || `${gradlew(dir)} publishToMavenLocal`;
  C.log.step(`Publicar en Maven local: ${cmd}`);
  C.run(cmd, { cwd: dir, env: { SDK_VERSION: version } });
  const [group, artifact] = s.paquete.split(":");
  const G = esc(group), A = esc(artifact);
  const touched = [];
  // 1) libs.versions.toml
  for (const toml of [path.join(root, "gradle", "libs.versions.toml")]) {
    if (!fs.existsSync(toml)) continue;
    let txt = fs.readFileSync(toml, "utf8"), changed = false;
    const lib = new RegExp(`^(\\s*[\\w-]+\\s*=\\s*\\{[^}]*(?:module\\s*=\\s*"${G}:${A}"|group\\s*=\\s*"${G}"[^}]*name\\s*=\\s*"${A}")[^}]*\\}?)[ \\t]*$`, "m");
    const m = lib.exec(txt);
    if (m) {
      const ref = /version\.ref\s*=\s*"([^"]+)"/.exec(m[1]);
      if (ref) { const re = new RegExp(`^(\\s*${ref[1]}\\s*=\\s*")[^"]*(")`, "m"); if (re.test(txt)) { txt = txt.replace(re, `$1${version}$2`); changed = true; } }
      else { txt = txt.replace(m[1], m[1].replace(/version\s*=\s*"[^"]*"/, `version = "${version}"`)); changed = true; }
    }
    if (changed) { fs.writeFileSync(toml, txt, "utf8"); touched.push(toml); C.log.ok(`gradle/libs.versions.toml: ${group}:${artifact} → ${version}`); }
  }
  // 2) build.gradle(.kts) con la coordenada literal
  const walk = (d, depth) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (depth > 0 && !["build", ".git", ".gradle", "node_modules", ".pipeline"].includes(e.name) && !e.name.startsWith(".")) walk(p, depth - 1); continue; }
      if (!/^build\.gradle(\.kts)?$/.test(e.name)) continue;
      const re = new RegExp(`(["']${G}:${A}:)[^"']+(["'])`, "g");
      const txt = fs.readFileSync(p, "utf8");
      if (re.test(txt)) { fs.writeFileSync(p, txt.replace(re, `$1${version}$2`), "utf8"); touched.push(p); C.log.ok(`${path.relative(root, p)}: ${group}:${artifact}:${version}`); }
    }
  };
  walk(root, 3);
  if (!touched.length) C.log.warn(`No encontré la dependencia ${group}:${artifact} en gradle/libs.versions.toml ni en ningún build.gradle(.kts) (3 niveles). Añádela a mano con la versión ${version}.`);
  // 3) mavenLocal()
  let hasLocal = false;
  for (const f of ["settings.gradle.kts", "settings.gradle", "build.gradle.kts", "build.gradle"]) {
    const p = path.join(root, f);
    if (fs.existsSync(p) && /mavenLocal\(\)/.test(fs.readFileSync(p, "utf8"))) { hasLocal = true; break; }
  }
  if (!hasLocal) {
    let done = false;
    for (const f of ["settings.gradle.kts", "settings.gradle", "build.gradle.kts", "build.gradle"]) {
      const p = path.join(root, f);
      if (!fs.existsSync(p)) continue;
      const txt = fs.readFileSync(p, "utf8");
      // primer bloque repositories { ... } (dependencyResolutionManagement o allprojects)
      const nt = txt.replace(/(repositories\s*\{\s*\n)/, "$1        mavenLocal()\n");
      if (nt !== txt) { fs.writeFileSync(p, nt, "utf8"); touched.push(p); C.log.ok(`${f}: añadido mavenLocal() al primer bloque repositories {}`); done = true; break; }
    }
    if (!done) C.log.warn("No encontré un bloque repositories {} donde añadir mavenLocal(); añádelo a mano en settings.gradle(.kts).");
  }
  return { artefacto: `~/.m2/repository/${group.replace(/\./g, "/")}/${artifact}/${version}`, archivos: touched.map((t) => path.relative(root, t)) };
}

function packIos(root, s, dir, version) {
  if (s.build) C.run(s.build, { cwd: dir });
  if (s.publicar) C.run(s.publicar, { cwd: dir, env: { SDK_VERSION: version } });
  const touched = [];
  // CocoaPods: pod 'Nombre' … → pod 'Nombre', :path => '<ruta relativa>'
  const podfiles = s.destino ? [path.resolve(root, s.destino)] : ["Podfile", "ios/Podfile", "app/Podfile"].map((f) => path.join(root, f)).filter((p) => fs.existsSync(p));
  for (const pf of podfiles) {
    if (!fs.existsSync(pf) || path.basename(pf) !== "Podfile") continue;
    const rel = path.relative(path.dirname(pf), dir).replace(/\\/g, "/");
    const txt = fs.readFileSync(pf, "utf8");
    const re = new RegExp(`^(\\s*pod\\s+['"]${s.paquete}['"]).*$`, "m");
    if (re.test(txt)) { fs.writeFileSync(pf, txt.replace(re, `$1, :path => '${rel}'`), "utf8"); touched.push(pf); C.log.ok(`${path.relative(root, pf)}: pod '${s.paquete}', :path => '${rel}'`); }
  }
  // Swift Package Manager: .package(url: "…<paquete>…") → .package(path: "<ruta relativa>")
  const swiftPkgs = ["Package.swift"].map((f) => path.join(root, f)).filter((p) => fs.existsSync(p));
  for (const sp of swiftPkgs) {
    const rel = path.relative(path.dirname(sp), dir).replace(/\\/g, "/");
    const txt = fs.readFileSync(sp, "utf8");
    const re = new RegExp(`\\.package\\(\\s*(?:name:\\s*"${s.paquete}",\\s*)?url:\\s*"[^"]*${s.paquete}[^"]*"[^)]*\\)`, "g");
    if (re.test(txt)) { fs.writeFileSync(sp, txt.replace(re, `.package(path: "${rel}")`), "utf8"); touched.push(sp); C.log.ok(`Package.swift: .package(path: "${rel}") para ${s.paquete}`); }
  }
  if (!touched.length) C.log.warn(`No encontré '${s.paquete}' en Podfile ni en Package.swift del padre. Añade la dependencia local a mano (pod '${s.paquete}', :path => '…' o .package(path: …)).`);
  const podDirs = touched.filter((t) => path.basename(t) === "Podfile").map((t) => path.dirname(t));
  if (podDirs.length) {
    if (process.platform !== "darwin") C.log.warn("pod install solo se ejecuta en macOS; en este sistema dejo el Podfile actualizado.");
    else if (!C.which("pod")) C.log.warn("CocoaPods no está instalado (brew install cocoapods); Podfile actualizado pero sin pod install.");
    else for (const d of podDirs) { C.log.step(`pod install (${path.relative(root, d) || "."})`); C.run("pod install", { cwd: d }); }
  }
  return { artefacto: `ruta local (${path.relative(root, dir).replace(/\\/g, "/") || "."})`, archivos: touched.map((t) => path.relative(root, t)) };
}

function packComando(root, s, dir, version) {
  if (s.build) C.run(s.build, { cwd: dir });
  const env = { SDK_VERSION: version, SDK_DIR: dir, SDK_NOMBRE: s.nombre, PROJECT_DIR: root };
  C.log.step(`Publicar: ${s.publicar}`);
  C.run(s.publicar, { cwd: dir, env });
  if (s.enlazar) { C.log.step(`Enlazar en el padre: ${s.enlazar}`); C.run(s.enlazar, { cwd: root, env }); }
  else C.log.warn("Sin 'enlazar' en la config: actualiza la dependencia del padre a mano.");
  return { artefacto: `(comando) versión ${version}`, archivos: [] };
}

function pack(root, s, opts) {
  const reg = getRegistry(root).sdks[s.nombre];
  const dir = reg && reg.dir && fs.existsSync(reg.dir) ? reg.dir : sync(root, s);
  const info = readVersion(s, dir);
  const noBump = s.tipo === "ios" && !s.publicar; // por ruta no hace falta versión
  const { version, n } = noBump ? { version: info.version || "", n: 0 } : nextLocalVersion(root, s, info.version);
  C.log.step(`Empaquetar SDK ${s.nombre} (${s.tipo}) · ${path.relative(root, dir) || "."} · versión de trabajo ${version || "(por ruta)"}`);
  const restore = noBump ? () => {} : setVersionTemp(s, info, version);
  let result;
  try {
    if (s.tipo === "npm") result = packNpm(root, s, dir, version);
    else if (s.tipo === "android") result = packAndroid(root, s, dir, version);
    else if (s.tipo === "ios") result = packIos(root, s, dir, version);
    else result = packComando(root, s, dir, version);
  } finally {
    restore(); // la versión -local.N nunca queda en el repo del SDK
  }
  const branch = C.currentBranch(dir), commit = git(dir, "rev-parse --short HEAD").out.trim();
  record(root, s.nombre, { dir, branch, commit, version: info.version || "", local_version: version, local_n: noBump ? (reg && reg.local_n) || 0 : n, artefacto: result.artefacto, archivos: result.archivos, feature: opts.feature || (reg && reg.feature) || "", packedAt: C.nowIso() });
  const st = C.getState(root);
  if (opts.feature || st.sdk === s.nombre) C.setState(root, { sdk: s.nombre, sdk_version: version });
  C.log.green(`\nSDK ${s.nombre} enlazado en el padre: ${version || "por ruta"}  ·  ${result.artefacto}`);
  if (result.archivos.length) C.log.plain(`Archivos del padre modificados: ${result.archivos.join(", ")}  (revísalos y haz commit en la rama feature/*)`);
  C.log.yellow(`Recuerda: antes de publicar la versión real del SDK, sustituye la dependencia -local.N por la versión publicada.`);
  return 0;
}

// --- Entrada ---------------------------------------------------------------------------------------------------
module.exports = async function sdk(opts) {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  const [sub, name] = opts._;
  const list = declared(cfg);
  if (!sub || sub === "list") {
    if (!list.length) { C.log.warn("No hay SDKs declarados. Añade una entrada en pipeline.config.json → SDKS (ver docs de SDKs)."); return 0; }
    const reg = getRegistry(root).sdks;
    C.log.step("SDKs declarados");
    for (const s of list) {
      const errs = validate(s), r = reg[s.nombre];
      if (errs.length) { C.log.fail(`${s.nombre}: ${errs.join("; ")}`); continue; }
      C.log.ok(`${s.nombre} (${s.tipo}, ${s.paquete || "-"}) · ${s.ruta ? "ruta " + s.ruta : "repo " + s.repo} · rama ${s.rama || "main"}${r ? ` · sincronizado ${r.branch}@${r.commit}${r.local_version ? " · enlazado " + r.local_version : ""}` : " · sin sincronizar"}`);
    }
    return 0;
  }
  if (sub === "status") {
    const reg = getRegistry(root).sdks;
    if (!Object.keys(reg).length) { C.log.warn("Ningún SDK sincronizado todavía (node kit.js sdk sync)."); return 0; }
    for (const [n, r] of Object.entries(reg)) console.log(`  ${n.padEnd(14)} ${r.tipo.padEnd(8)} ${(r.branch || "?") + "@" + (r.commit || "?")}  v${r.version || "?"}  enlazado: ${r.local_version || "-"}  ${r.artefacto || ""}`);
    return 0;
  }
  if (sub === "sync") {
    const targets = !name || name === "--all" || opts.all ? list : [find(cfg, name)];
    if (!targets.length) { C.log.warn("No hay SDKs declarados."); return 0; }
    for (const s of targets) { const errs = validate(s); if (errs.length) { C.log.fail(`${s.nombre}: ${errs.join("; ")}`); continue; } sync(root, s, opts.rama); }
    return 0;
  }
  if (sub === "pack") {
    if (!name) { C.log.fail("Uso: node kit.js sdk pack <nombre> [--feature slug]"); return 1; }
    return pack(root, find(cfg, name), { feature: opts.feature });
  }
  C.log.fail(`Subcomando desconocido: ${sub}. Usa: list | sync [nombre|--all] | pack <nombre> | status`);
  return 1;
};
module.exports.declared = declared;
module.exports.validate = validate;
module.exports.getRegistry = getRegistry;
module.exports.resolveDir = resolveDir;
