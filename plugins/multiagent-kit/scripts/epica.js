// Épicas: una idea grande partida en varias historias de usuario (HU), cada una un pipeline. Vive en docs/epicas/<nombre>.md
// (tabla de HU con estado) y el kit la mantiene al día leyendo lo que hay en disco (specs, ADR, informes, ramas, estado).
//   node kit.js epica list                                   -> épicas y progreso
//   node kit.js epica status [nombre]                        -> estado real de cada HU (lo recalcula desde disco y actualiza la tabla) y el siguiente comando
//   node kit.js epica add <nombre> <slug> "Título" [ticket]  -> añade una HU (crea la épica si no existe)
//   node kit.js epica set <nombre> <slug> estado=x [notas="…"] -> fija a mano el estado/notas de una HU (p. ej. bloqueada)
//   node kit.js epica next <nombre>                          -> imprime solo el slug de la siguiente HU pendiente (lo usa el orquestador)
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const C = require("./common");

const ESTADOS = ["pendiente", "spec", "arquitectura", "implementacion", "qa", "revisiones", "staging", "documentacion", "terminada", "bloqueada", "descartada"];
const COLS = ["#", "HU", "Slug", "Ticket", "Estado", "Depende de", "Notas"];

function dir(root) { return path.join(root, "docs", "epicas"); }
function file(root, name) { return path.join(dir(root), `${name}.md`); }
function listNames(root) { return fs.existsSync(dir(root)) ? fs.readdirSync(dir(root)).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => f.slice(0, -3)) : []; }

// --- Lectura/escritura del archivo ---------------------------------------------------------------------
function parse(txt) {
  const lines = txt.split(/\r?\n/);
  const hus = [];
  let tableStart = -1, tableEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (tableStart < 0 && /^\|\s*#\s*\|/.test(l)) { tableStart = i; continue; }
    if (tableStart >= 0) {
      if (!/^\|/.test(l)) { tableEnd = i; break; }
      if (/^\|\s*-/.test(l)) continue;
      const cells = l.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length < 5) continue;
      hus.push({ n: cells[0], titulo: cells[1], slug: cells[2], ticket: cells[3], estado: cells[4], depende: cells[5] || "", notas: cells[6] || "" });
    }
  }
  if (tableStart >= 0 && tableEnd < 0) tableEnd = lines.length;
  const title = (lines.find((l) => /^#\s+/.test(l)) || "").replace(/^#\s+/, "").replace(/^Épica:\s*/i, "");
  return { lines, hus, tableStart, tableEnd, title };
}
function render(hus) {
  const rows = hus.map((h, i) => `| ${h.n || i + 1} | ${h.titulo} | \`${h.slug}\` | ${h.ticket || ""} | ${h.estado} | ${h.depende || ""} | ${h.notas || ""} |`);
  return [`| ${COLS.join(" | ")} |`, `|${COLS.map(() => "---").join("|")}|`].concat(rows);
}
function load(root, name) {
  const f = file(root, name);
  if (!fs.existsSync(f)) return null;
  const p = parse(fs.readFileSync(f, "utf8"));
  p.hus.forEach((h) => { h.slug = h.slug.replace(/`/g, ""); });
  return p;
}
function save(root, name, parsed) {
  const f = file(root, name);
  const out = parsed.tableStart >= 0
    ? parsed.lines.slice(0, parsed.tableStart).concat(render(parsed.hus), parsed.lines.slice(parsed.tableEnd))
    : parsed.lines.concat(parsed.lines.some((l) => /^##\s+Historias/.test(l)) ? [""] : ["", "## Historias de usuario", ""], render(parsed.hus), [""]);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, out.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
}
function create(root, name, titulo, extra = {}) {
  const lines = [
    `# Épica: ${titulo || name}`, "",
    `Creada: ${C.nowIso().slice(0, 10)}${extra.ticket ? " · Ticket: " + extra.ticket : ""}`, "",
    "Idea original: " + (extra.idea || "(pendiente)"), "",
    "Cada HU es un `/pipeline` completo. `node kit.js epica status " + name + "` recalcula el estado desde disco; `/pipeline continuar " + name + "` retoma la siguiente HU.", "",
    "## Historias de usuario", "",
  ];
  const p = { lines, hus: [], tableStart: -1, tableEnd: -1, title: titulo || name };
  save(root, name, p);
  return load(root, name);
}

// --- Estado real desde disco ----------------------------------------------------------------------------
function verdict(root, slug, kind) {
  if (kind === "pr") { const j = C.readJson(path.join(root, ".pipeline", "pr", `${slug}.json`), null); return j ? (["CREADO", "RAMA SUBIDA"].includes(j.estado) ? "APROBADO" : "PENDIENTE") : ""; }
  const f = path.join(root, "docs", "reviews", `${slug}-${kind}.md`);
  if (!fs.existsSync(f)) return "";
  const t = fs.readFileSync(f, "utf8");
  if (kind === "release") return /^\s*STAGING:\s*(LISTO|MANUAL)/m.test(t) ? "APROBADO" : /^\s*STAGING:\s*FALL/m.test(t) ? "RECHAZADO" : "PENDIENTE";
  const v = C.textVerdict(t, "(?:QA|C[OÓ]DIGO|VEREDICTO)");
  return v === "CONTRADICTORIO" ? "PENDIENTE" : v;
}
function gitOk(root, args) { const r = spawnSync("git", ["-C", root].concat(args), { encoding: "utf8" }); return r.status === 0 ? (r.stdout || "").trim() : null; }
function diskState(root, slug, state) {
  const has = (p) => fs.existsSync(path.join(root, p));
  const branchList = gitOk(root, ["branch", "--list", `feature/${slug}`, `fix/${slug}`]) || "";
  const branch = branchList.replace(/^\*?\s*/gm, "").split(/\r?\n/).filter(Boolean)[0] || "";
  const mainBranch = ["main", "master"].find((b) => gitOk(root, ["rev-parse", "--verify", "--quiet", b]) !== null) || "main";
  // fusionada = tiene commits propios y todos están ya en main (una rama recién creada sin commits no cuenta)
  const ahead = branch ? parseInt(gitOk(root, ["rev-list", "--count", `${mainBranch}..${branch}`]) || "0", 10) : 0;
  const own = branch ? gitOk(root, ["rev-parse", branch]) !== gitOk(root, ["rev-parse", mainBranch]) : false;
  const v = { qa: verdict(root, slug, "qa"), codigo: verdict(root, slug, "codigo"), seguridad: verdict(root, slug, "seguridad"), release: verdict(root, slug, C.FLAVOR === "copilot" ? "pr" : "release") };
  // tras un fast-forward la punta de la rama coincide con main: se considera fusionada solo si además hubo QA
  const merged = branch ? ahead === 0 && (own || !!v.qa) : false;
  let estado = "pendiente", detalle = "";
  if (has(`docs/specs/${slug}.md`)) estado = "spec";
  if (has(`docs/adr/${slug}.md`)) estado = "arquitectura";
  if (branch) { estado = "implementacion"; detalle = branch; }
  if (v.qa) estado = v.qa === "APROBADO" ? "revisiones" : "qa";
  if (v.qa === "APROBADO" && v.codigo && v.seguridad) estado = v.codigo === "APROBADO" && v.seguridad === "APROBADO" ? "staging" : "revisiones";
  if (v.release === "APROBADO") estado = "terminada";
  if (merged) { estado = "terminada"; detalle = `${branch} → ${mainBranch}`; }
  // el estado vivo manda si el pipeline está en esta HU ahora mismo
  if (state && state.feature === slug && state.stage && !merged && v.release !== "APROBADO") estado = ({ spec: "spec", arquitectura: "arquitectura", implementacion: "implementacion", qa: "qa", revisiones: "revisiones", pr: "revisiones", staging: "staging", documentacion: "documentacion", entrega: "terminada", reproducir: "qa", corregir: "implementacion" })[state.stage] || estado;
  const pendientes = [];
  if (estado !== "terminada") {
    if (!has(`docs/specs/${slug}.md`)) pendientes.push("spec");
    else if (!has(`docs/adr/${slug}.md`) && (!state || state.compuertas !== "reducidas")) pendientes.push("ADR");
    if (v.qa !== "APROBADO") pendientes.push("QA");
    if (v.codigo !== "APROBADO") pendientes.push("revisión código");
    if (v.seguridad !== "APROBADO") pendientes.push("seguridad");
    if (v.release !== "APROBADO") pendientes.push(C.FLAVOR === "copilot" ? "PR" : "staging");
  }
  return { estado, detalle, pendientes, branch, merged };
}
function nextHu(hus) {
  const done = new Set(hus.filter((h) => ["terminada", "descartada"].includes(h.estado)).map((h) => h.slug));
  const inProgress = hus.find((h) => !["pendiente", "terminada", "descartada", "bloqueada"].includes(h.estado));
  if (inProgress) return { hu: inProgress, motivo: "en curso" };
  for (const h of hus) {
    if (h.estado !== "pendiente") continue;
    const deps = (h.depende || "").split(/[,\s]+/).map((d) => d.replace(/`/g, "")).filter(Boolean);
    const blocked = deps.filter((d) => !done.has(d) && !hus.find((x) => x.n === d && done.has(x.slug)));
    if (!blocked.length) return { hu: h, motivo: "siguiente pendiente" };
  }
  return null;
}

// --- Comando ---------------------------------------------------------------------------------------------
function status(root, name, { quiet } = {}) {
  const p = load(root, name);
  if (!p) throw new Error(`No existe docs/epicas/${name}.md. Épicas: ${listNames(root).join(", ") || "(ninguna)"}`);
  const state = C.getState(root);
  let changed = false;
  for (const h of p.hus) {
    if (["bloqueada", "descartada"].includes(h.estado)) continue; // fijados a mano
    const d = diskState(root, h.slug, state);
    if (d.estado === "pendiente" && h.estado === "terminada") { h._disk = { estado: "terminada", detalle: "", pendientes: [] }; continue; } // cerrada a mano (sin rastro en disco): se respeta
    if (d.estado !== h.estado) { h.estado = d.estado; changed = true; }
    h._disk = d;
  }
  if (changed) save(root, name, p);
  const done = p.hus.filter((h) => h.estado === "terminada").length;
  if (!quiet) {
    C.log.step(`Épica ${name}: ${p.title}  ·  ${done}/${p.hus.length} HU terminadas`);
    for (const h of p.hus) {
      const d = h._disk || {};
      const tag = h.estado === "terminada" ? "[OK]" : ["bloqueada", "descartada"].includes(h.estado) ? "[--]" : h.estado === "pendiente" ? "[  ]" : "[..]";
      console.log(`  ${tag} ${String(h.n).padStart(2)}  ${h.slug.padEnd(38)} ${h.estado.padEnd(15)} ${h.ticket ? h.ticket + "  " : ""}${d.detalle || ""}${d.pendientes && d.pendientes.length && h.estado !== "pendiente" ? "  falta: " + d.pendientes.join(", ") : ""}${h.notas ? "  · " + h.notas : ""}`);
    }
    const nx = nextHu(p.hus);
    if (!nx) C.log.green(done === p.hus.length ? "\nÉpica completa." : "\nNada que retomar: las HU restantes están bloqueadas o descartadas.");
    else {
      const spec = fs.existsSync(path.join(root, "docs", "specs", `${nx.hu.slug}.md`));
      C.log.cyan(`\nSiguiente (${nx.motivo}): ${nx.hu.n}. ${nx.hu.titulo} (${nx.hu.slug})`);
      C.log.plain(spec || nx.hu.estado !== "pendiente" ? `/pipeline continuar ${nx.hu.slug}` : `/pipeline ${nx.hu.ticket ? nx.hu.ticket + " " : ""}"${nx.hu.titulo}"   (slug: ${nx.hu.slug}, épica: ${name})`);
      if (state.feature && state.feature !== nx.hu.slug) C.log.plain(`Antes: node kit.js state reset   (el estado actual es de ${state.feature})`);
    }
  }
  return { p, next: nextHu(p.hus), done };
}

module.exports = async function epica(opts) {
  const root = C.requireProjectRoot();
  const [sub, name, slug, ...rest] = opts._;
  if (!sub || sub === "list") {
    const names = listNames(root);
    if (!names.length) { C.log.warn("No hay épicas (docs/epicas/*.md). El product-owner las crea al partir una idea en varias HU, o: node kit.js epica add <nombre> <slug> \"Título\""); return 0; }
    C.log.step("Épicas");
    for (const n of names) { const { p, done, next } = status(root, n, { quiet: true }); C.log.ok(`${n.padEnd(28)} ${done}/${p.hus.length} HU  ${next ? "→ " + next.hu.slug : "completa"}`); }
    return 0;
  }
  if (sub === "status") {
    const names = name ? [name] : listNames(root);
    if (!names.length) { C.log.warn("No hay épicas."); return 0; }
    for (const n of names) status(root, n);
    return 0;
  }
  if (sub === "next") {
    if (!name) { C.log.fail("Uso: node kit.js epica next <nombre>"); return 1; }
    const { next } = status(root, name, { quiet: true });
    if (next) console.log(next.hu.slug);
    return next ? 0 : 1;
  }
  if (sub === "add") {
    if (!name || !slug) { C.log.fail("Uso: node kit.js epica add <nombre> <slug> \"Título\" [ticket]"); return 1; }
    let p = load(root, name) || create(root, name, opts.titulo || name, { idea: opts.idea, ticket: opts.ticket });
    if (p.hus.find((h) => h.slug === slug)) { C.log.warn(`La HU ${slug} ya está en la épica.`); return 0; }
    const ticket = rest.find((r) => /^[A-Za-z]+-\d+$/.test(r)) || "";
    const titulo = rest.filter((r) => r !== ticket).join(" ") || slug;
    p.hus.push({ n: String(p.hus.length + 1), titulo, slug, ticket: ticket.toUpperCase(), estado: "pendiente", depende: opts.depende || "", notas: "" });
    save(root, name, p);
    C.log.ok(`HU ${p.hus.length}: ${titulo} (${slug}) añadida a docs/epicas/${name}.md`);
    return 0;
  }
  if (sub === "set") {
    if (!name || !slug) { C.log.fail("Uso: node kit.js epica set <nombre> <slug> estado=x [notas=\"…\"] [ticket=X] [depende=slug]"); return 1; }
    const p = load(root, name); if (!p) { C.log.fail(`No existe la épica ${name}`); return 1; }
    const h = p.hus.find((x) => x.slug === slug); if (!h) { C.log.fail(`La HU ${slug} no está en la épica ${name}`); return 1; }
    for (const kv of rest) { const m = /^(estado|notas|ticket|depende|titulo)=(.*)$/.exec(kv); if (!m) continue; if (m[1] === "estado" && !ESTADOS.includes(m[2])) { C.log.fail(`Estado no válido: ${m[2]} (${ESTADOS.join(", ")})`); return 1; } h[m[1]] = m[1] === "ticket" ? m[2].toUpperCase() : m[2]; }
    save(root, name, p);
    C.log.ok(`${slug}: ${rest.join(", ")}`);
    return 0;
  }
  C.log.fail(`Subcomando desconocido: ${sub}. Usa: list | status [nombre] | next <nombre> | add <nombre> <slug> "Título" [ticket] | set <nombre> <slug> estado=…`);
  return 1;
};
module.exports.listNames = listNames;
module.exports.status = status;
module.exports.load = load;
