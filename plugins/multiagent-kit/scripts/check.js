// Verifica que la máquina tiene todo lo necesario para el flujo multiagente. Uso:  node kit.js check
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./common");

const HINTS = {
  git: { windows: "winget install Git.Git", macos: "xcode-select --install  (o brew install git)", linux: "sudo apt install git" },
  node: { windows: "winget install OpenJS.NodeJS.LTS", macos: "brew install node", linux: "sudo apt install nodejs npm" },
  docker: { windows: "winget install Docker.DockerDesktop", macos: "brew install --cask docker", linux: "https://docs.docker.com/engine/install/" },
  supabase: { windows: "winget install Supabase.cli  (o scoop install supabase)", macos: "brew install supabase/tap/supabase", linux: "brew install supabase/tap/supabase" },
  claude: { windows: "irm https://claude.ai/install.ps1 | iex", macos: "curl -fsSL https://claude.ai/install.sh | bash", linux: "curl -fsSL https://claude.ai/install.sh | bash" },
  copilot: { windows: "npm install -g @github/copilot", macos: "npm install -g @github/copilot", linux: "npm install -g @github/copilot" },
};
const hint = (k) => "Instala: " + HINTS[k][C.OS_NAME];

module.exports = async function check() {
  const root = C.requireProjectRoot();
  const cfg = C.loadConfig(root);
  let ok = true;
  const test = (name, cmd, h) => {
    const r = C.run(cmd, { ignoreFailure: true, quiet: true });
    if (r.code === 0) C.log.ok(`${name} : ${(r.out || "").trim().split(/\r?\n/)[0]}`);
    else { C.log.fail(`${name} no encontrado. ${h}`); ok = false; }
  };

  C.log.step(`Sistema: ${C.OS_NAME} · Node ${process.version}`);
  const major = parseInt(process.version.slice(1), 10);
  if (major < 18) { C.log.fail(`Node ${process.version}: el kit requiere Node 18 o superior. ${hint("node")}`); ok = false; } else C.log.ok("Node >= 18");

  C.log.step("Herramientas base");
  test("Git", "git --version", hint("git"));
  if (C.FLAVOR === "claude") test("Claude Code", "claude --version", hint("claude"));
  else test("Copilot CLI", "copilot --version", hint("copilot"));

  if (cfg._source === "ps1") C.log.warn("El proyecto usa pipeline.config.ps1 (formato antiguo). Ejecuta: node kit.js migrate");
  if (["docker", "compose"].includes(cfg.STAGING_PROVIDER)) {
    test("Docker", "docker --version", hint("docker"));
    C.log.step("Docker en ejecución");
    const r = C.run("docker info", { ignoreFailure: true, quiet: true });
    if (r.code === 0) C.log.ok("Docker responde"); else { C.log.fail("Docker no está corriendo. Abre Docker Desktop y espera a que diga 'Engine running'."); ok = false; }
  } else C.log.warn(`Proveedor de staging '${cfg.STAGING_PROVIDER}': Docker no es necesario.`);

  if (cfg.STAGING_PROVIDER === "supabase") {
    C.log.step("Supabase CLI (proveedor de staging = supabase)");
    test("Supabase CLI", "supabase --version", hint("supabase"));
    if (!cfg.SUPABASE_STAGING_REF || !cfg.SUPABASE_PROD_REF) { C.log.fail("SUPABASE_STAGING_REF / SUPABASE_PROD_REF vacíos en pipeline.config.json (ver docs/10-supabase.md)"); ok = false; }
    else if (cfg.SUPABASE_STAGING_REF === cfg.SUPABASE_PROD_REF) { C.log.fail("Staging y producción apuntan al mismo proyecto Supabase"); ok = false; }
  }

  C.log.step("Archivos del proyecto");
  const mf = C.readJson(path.join(root, ".github", "kit-manifest.json"), null) || C.readJson(path.join(root, ".pipeline", "kit-manifest.json"), null);
  const kitMode = (mf && mf.mode) || "repo";
  if (!mf) C.log.warn("Falta el manifiesto del kit: ejecuta node kit.js init");
  else if (mf.version === C.VERSION) C.log.ok(`Plugin v${C.VERSION} y archivos del proyecto v${mf.version} (modo ${kitMode})`);
  else C.log.warn(`Plugin v${C.VERSION} pero archivos del proyecto v${mf.version}: ejecuta node kit.js update`);
  const must = [C.CONTEXT_FILE, "kit.js"];
  if (C.FLAVOR === "copilot" && kitMode !== "usuario") must.push(".github/hooks/kit.json", ".github/agents/director.agent.md", ".github/skills/pipeline/SKILL.md");
  if (C.FLAVOR === "claude") must.push(".claude/settings.json");
  for (const f of must) if (fs.existsSync(path.join(root, f))) C.log.ok(f); else C.log.warn(`Falta ${f} (node kit.js init)`);
  if (C.FLAVOR === "copilot" && kitMode === "usuario") {
    const U = require("./user-install");
    const home = U.copilotHome();
    for (const f of ["agents/director.agent.md", "skills/pipeline/SKILL.md", "hooks/multiagent-kit.json", "multiagent-kit-hook.js"])
      if (fs.existsSync(path.join(home, f))) C.log.ok(`~/.copilot/${f}`); else C.log.warn(`Falta ~/.copilot/${f} (node kit.js update)`);
    const vs = U.vscodePromptsDir();
    if (fs.existsSync(path.join(vs, "pipeline.prompt.md"))) C.log.ok(`VS Code: ${vs}`); else C.log.warn(`VS Code: no hay prompts del kit en ${vs} (solo importa si usas VS Code)`);
  }
  if (kitMode !== "repo") {
    const ex = path.join(root, ".git", "info", "exclude");
    if (fs.existsSync(ex) && /multiagent-kit/.test(fs.readFileSync(ex, "utf8"))) C.log.ok(".git/info/exclude contiene los archivos del kit (nada del kit va a git)");
    else C.log.warn("No encuentro las exclusiones del kit en .git/info/exclude: ejecuta node kit.js update");
  }

  C.log.step("Configuración del proyecto");
  if (!String(cfg.TEST_CMD || "").trim()) C.log.warn("TEST_CMD está vacío en pipeline.config.json — el agente tester no podrá correr pruebas.");
  if (!String(cfg.PROD_DEPLOY_CMD || "").trim() && cfg.STAGING_PROVIDER !== "supabase") C.log.warn("PROD_DEPLOY_CMD está vacío — node kit.js prod solo simulará el despliegue.");
  if (!String(cfg.SMOKE_CMD || "").trim()) C.log.warn("SMOKE_CMD está vacío — el smoke solo probará la salud; define un comando de smoke del proyecto.");
  const over = C.docLimits(root, cfg);
  if (over.length) { C.log.warn("Documentos por encima del límite:"); over.forEach((o) => C.log.warn("  " + o)); }

  const S = require("./sdk");
  const sdks = S.declared(cfg);
  if (sdks.length) {
    C.log.step(`SDKs declarados (${sdks.length})`);
    for (const s of sdks) {
      const errs = S.validate(s);
      if (errs.length) { C.log.fail(`${s.nombre || "(sin nombre)"}: ${errs.join("; ")}`); ok = false; continue; }
      const local = s.ruta && fs.existsSync(path.resolve(root, s.ruta));
      if (!local && !s.repo) { C.log.fail(`${s.nombre}: la ruta ${s.ruta} no existe y no hay repo`); ok = false; }
      else C.log.ok(`${s.nombre} (${s.tipo}) · ${local ? "ruta " + s.ruta : "se clonará de " + s.repo + " (rama " + (s.rama || "main") + ")"}`);
      if (s.tipo === "android" && !fs.existsSync(path.join(root, "gradle", "libs.versions.toml")) && !fs.existsSync(path.join(root, "build.gradle.kts")) && !fs.existsSync(path.join(root, "build.gradle"))) C.log.warn(`${s.nombre}: el padre no parece un proyecto Gradle (sin build.gradle ni libs.versions.toml)`);
      if (s.tipo === "ios" && process.platform === "darwin" && !C.which("pod")) C.log.warn(`${s.nombre}: CocoaPods no instalado (brew install cocoapods); solo importa si usas Podfile`);
    }
  }

  if (ok) { C.log.green(`\nTodo listo. Abre '${C.FLAVOR === "claude" ? "claude" : "copilot"}' en la raíz del proyecto y ejecuta /pipeline "tu idea".`); return 0; }
  C.log.red("\nFaltan herramientas. Revisa los mensajes [XX] arriba."); return 1;
};
