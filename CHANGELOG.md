# Changelog

## 1.4.0 — ticket de Jira, doctor, modo rápido, lecciones, SDK publish y breaking changes
- **Ticket de Jira en ramas y commits**: si la idea de `/pipeline` o `/bugfix` incluye `abc-123`, el ticket va en MAYÚSCULAS al slug (`BMOSHELL-123-login-biometrico`), a la rama (`feature/…`, `fix/…`, también en el SDK), a los documentos y al tag de producción; los commits siguen `<tipo>: BMOSHELL-123 descripción`. El hook bloquea ramas `feature/*`/`fix/*` y commits sin el ticket mientras esté registrado (`node kit.js state ticket=…`).
- **Aviso de versión nueva**: el hook de inicio de sesión y `node kit.js update` comparan la versión instalada con GitHub (una vez al día) y dicen cómo actualizar; `node kit.js update --plugin` ejecuta `copilot plugin update`.
- **`node kit.js doctor [--fix]`**: diagnóstico del kit — plugin, archivos y modo del proyecto, hooks (prueba real), permisos, `.kit`, locks de git, `SDKS` — con arreglo por problema; `--fix` aplica los seguros.
- **`update --limpiar`** borra las copias `.kit` revisadas; **`state reset`** cierra la feature (archiva en `.pipeline/historial.jsonl`) y limpia el estado; claves nuevas `tamano` y `compuertas`.
- **Modo rápido**: el product-owner estima `TAMAÑO: S|M|L`; con `--rapido` o S confirmado por el usuario, el pipeline omite el ADR (nota técnica en la spec) y el revisor de código, mantiene QA y seguridad, y registra `compuertas=reducidas`.
- **Lecciones entre proyectos**: `~/.multiagent-kit/lecciones.md`, que `/retro-kit` alimenta (`node kit.js lecciones add "…"`) y que arquitecto, implementador, tester y release-manager leen al empezar.
- **`sdk api <nombre>`**: instantánea de la API pública en `sdk sync` (`.d.ts`, `api/*.api` de BCV o fuentes) y comparación: símbolos eliminados sin subir la major = BREAKING (error; el revisor de código lo trata como BLOQUEANTE; `sdk pack` avisa).
- **`sdk publish <nombre> --version X.Y.Z`**: paso humano que fija la versión definitiva en el SDK (+ commit), cambia la dependencia del padre a la publicada, borra el tgz local y lista lo que queda por hacer. Bloqueado para los agentes por el hook.
- Prompt `/pipeline` acepta `--rapido`; el director confirma el modo rápido como compuerta humana.

## 1.3.2
- `init --modo usuario` en un proyecto que ya estaba en modo `repo`/`local` retira de `.github/` (y `.gitignore`/`.dockerignore`) lo que el kit había copiado, siempre que siga idéntico a lo copiado; lo que editaste se conserva y se avisa. Así cambiar de modo no deja archivos del kit en el repositorio.

## 1.3.1
- `update`/`init`: los hashes de archivos gestionados ignoran CRLF/LF, así que git en Windows (`autocrlf`) ya no hace que `kit.js` aparezca como "modificado por ti" y se quede sin actualizar.
- Los archivos tuyos (`pipeline.config.json`, `CLAUDE.md`/`AGENTS.md`, plantillas de `docs/`, `staging/`) solo generan una copia `.kit` cuando la plantilla del kit cambió desde tu último `update` (antes se regeneraban en cada ejecución). Borra los `.kit` antiguos que ya revisaste.

## 1.3.0 — SDKs del equipo y flujo end-to-end
- Nueva sección `SDKS` en `pipeline.config.json`: librerías propias que el proyecto consume (`npm`, `android`, `ios` o `comando`), por ruta local y/o repo git con rama (`main` por defecto; el clon va a `.pipeline/sdks/<nombre>`, fuera de git).
- `node kit.js sdk list|sync|pack|status`: sincroniza el SDK, genera una versión de trabajo `X.Y.Z-local.N` sin tocar el repo del SDK ni registros remotos, la publica en local (npm: tgz versionado en `vendor/sdks/` + `file:` en `package.json` + install; Android: `publishToMavenLocal` + versión en `libs.versions.toml`/gradle + `mavenLocal()`; iOS: `:path` en Podfile o `.package(path:)`) y actualiza la dependencia del padre.
- `/pipeline --sdk <nombre> "idea"`: la feature nace en el SDK (rama `feature/*`, commits sin push), se empaqueta y se integra en el padre en el mismo pipeline; spec y ADR separan SDK y padre; tester y revisores cubren ambos repos; la entrega recuerda los pasos humanos (PR del SDK, versión real, sustituir `-local.N`).
- Sin `--sdk`, los SDKs declarados son contexto de solo lectura para el arquitecto.
- Hooks: `protect-main` y `commit-gate` reconocen `git -C <dir>` y `cd <dir> && git …`, así que vigilan también el repo del SDK (compuerta con `test`/`lint` de la entrada del SDK). `check` valida `SDKS`; `session-start` los anuncia; estado con claves `sdk` y `sdk_version`.
- Prompt `/pipeline` de VS Code acepta `--sdk <nombre> idea`; el agente `director` sincroniza los SDKs al empezar.
## 1.2.0 — modos de instalación
- `node kit.js init --modo repo|local|usuario` (`/kit-init` lo pregunta). `local`: los archivos del kit van a `.git/info/exclude` (nada en git, solo este clon). `usuario`: nada del kit en el repositorio; agentes, skills, hooks y prompts se instalan en `~/.copilot/{agents,skills,hooks}` y en la carpeta de prompts de usuario de VS Code, válidos para todos los proyectos; en el proyecto solo quedan config, `kit.js`, `AGENTS.md`, `.pipeline/` y plantillas, excluidos de git. Hook de usuario con lanzador `~/.copilot/multiagent-kit-hook.js` que no interfiere en repos sin kit. `update` recuerda el modo y refresca el perfil. `check` verifica el perfil y el exclude.
- Agentes, prompts y director aceptan las skills desde `.github/skills/`, `~/.copilot/skills/` o el plugin.

## 1.1.1
- `kit.js`: corrige la búsqueda del plugin instalado (Claude Code lo guarda en `~/.claude/plugins/cache/<marketplace>/multiagent-kit/<versión>/`); ahora reconoce el plugin por el `name` de su manifiesto, no por el nombre de la carpeta. En proyectos ya migrados: `node kit.js update` (o copiar el `kit.js` nuevo).

## 1.1.0 — scripts en Node.js, sin PowerShell
- **Todos los scripts del kit reescritos en Node.js** (`scripts/*.js`, `kit.js` en el proyecto). Un solo código para Windows, macOS y Linux y el sandbox del cloud agent; no hace falta PowerShell 7 ni permisos de ejecución: solo Node ≥ 18, que ya exige la propia herramienta. Comandos idénticos en todos los sistemas: `node kit.js check|staging|smoke|prod|status|state|init|update|migrate|version`.
- **`pipeline.config.json`** sustituye a `pipeline.config.ps1` (mismas claves). `node kit.js migrate` (o `init`) convierte el archivo antiguo y lo deja como `.migrado`; mientras exista solo el `.ps1`, los scripts lo leen y avisan.
- **Hooks** unificados en `scripts/hook.js` (`protect-main`, `commit-gate`, `session-start`): entienden el evento de Claude Code / VS Code (PascalCase) y el de Copilot (camelCase); `.github/hooks/kit.json` los lanza con `node kit.js hook …` en `command`, `bash` y `powershell` (el mismo comando para VS Code, CLI y cloud agent).
- **`kit.js`** localiza el plugin en `~/.claude/plugins` o `~/.copilot/installed-plugins`, `.pipeline/kit.json` o `KIT_PLUGIN_ROOT`; `kit.js` es ahora un archivo gestionado (se refresca con `node kit.js update`).
- Los agentes ya no necesitan distinguir Windows/macOS para los comandos del kit; la sección "Sistema operativo" queda para `gradlew`, `winget`/`brew` y rutas.
- `check` muestra el sistema y da pistas de instalación por sistema (winget / brew / apt). Documentación actualizada (instalación Windows y macOS, sin PowerShell).
- **Migración de un proyecto existente**: actualizar el plugin, ejecutar en el proyecto `node "<plugin>/scripts/cli.js" init` (crea `kit.js`, convierte la config) y borrar `kit.ps1` y `pipeline.config.ps1.migrado` cuando estés conforme. En proyectos ya inicializados con la 1.0.x: `node "<plugin>/scripts/cli.js" init` y luego `node kit.js update`.

## 1.0.2
- **Windows y macOS/Linux**: los agentes detectan el sistema operativo antes de ejecutar comandos (sección "Sistema operativo" en `AGENTS.md`, en los agentes implementador/tester/release-manager y en `.github/instructions/kit.instructions.md`) y usan la forma correcta (`node kit.js` / `kit.js`, `.\gradlew` / `./gradlew`, `winget` / `brew`). Los scripts usan `cmd` o `sh` según el sistema y rutas con `/`. `node kit.js check` da pistas de instalación por sistema y muestra el SO detectado. Guía 01 con sección macOS.

## 1.0.1
- `stack-react-native`: React Native **bare con CLI, sin Expo** reforzado: comando de creación (`npx @react-native-community/cli@latest init`), detección de proyectos Expo (se avisa, no se convierte), prohibición explícita de `expo install`/`expo-router`/EAS, React Navigation en vez de `expo-router`, punto de revisión que rechaza dependencias `expo-*` sin ADR, tabla de comandos para `pipeline.config.json` (Gradle, Jest, tsc, staging `comando` con APK/Maestro) y `expo/skills` retirada de las complementarias. En los proyectos ya inicializados: `node kit.js update`.

## 1.0.0
Primera versión del kit multiagente para GitHub Copilot, equivalente a `multiagent-kit` 1.6.0 de Claude Code.

- **Plugin** en formato Agent Plugins 1.0 (`plugins/multiagent-kit/plugin.json`) con marketplace `carlos-kits-copilot` en `marketplace.json` (raíz del repositorio). Instalación: `copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot` + `copilot plugin install multiagent-kit@carlos-kits-copilot`.
- **Agentes** (`com.github.copilot/agents/*.agent.md`): `director` (orquestador, nuevo), `product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`. Herramientas con alias de Copilot; sin memoria ni worktree por agente; skill de método leída al empezar.
- **Skills**: `pipeline`, `analisis`, `bugfix`, `ideas`, `retro-kit`, `deploy-staging`, `promote-prod`, `kit-init`, `metodo-{spec,adr,code-review,qa,deploy}`, `stack-{android,react-native,nestjs,ktor,db}`. Bloque "Cómo delegar (GitHub Copilot)" en las skills orquestadoras.
- **Proyecto** (`node kit.js init`): `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/kit.instructions.md`, `.github/copilot/settings.json` (auto-instala el plugin en CLI y cloud agent), `.github/workflows/copilot-setup-steps.yml`, prompts de VS Code (`.github/prompts/*.prompt.md`), copias gestionadas de agentes, skills y hooks con manifiesto de hashes (`.github/kit-manifest.json`) y comando `node kit.js update`.
- **Hooks** (`.github/hooks/kit.json` → `node kit.js hook …`): `session-start` (contexto + aviso de versión), `protect-main` (ramas protegidas, merge sin `VEREDICTO: APROBADO`, producción, comandos destructivos, `.env*`/keystores), `commit-gate` (lint + tests). Aceptan payload camelCase (CLI/cloud) y PascalCase (VS Code); denegación por JSON `permissionDecision` + exit 2. Requieren PowerShell 7 en Windows.
- **Scripts** de staging (`docker`, `compose`, `supabase`, `comando`, `ninguno`), smoke, promoción a producción con compuertas y estado v2, ahora multiplataforma (Windows y Linux) para el cloud agent.
- **Documentación**: 13 guías (instalación, publicar, usar, flujo, arquitectura viva, actualizar, problemas, superficies de Copilot, cloud agent y GitHub, Supabase, staging por proveedor, skills externas, diferencias con el kit de Claude).
