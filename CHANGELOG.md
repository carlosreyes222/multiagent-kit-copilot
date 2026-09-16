# Changelog

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
