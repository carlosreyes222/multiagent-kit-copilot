# Changelog

## 1.0.1
- `stack-react-native`: React Native **bare con CLI, sin Expo** reforzado: comando de creación (`npx @react-native-community/cli@latest init`), detección de proyectos Expo (se avisa, no se convierte), prohibición explícita de `expo install`/`expo-router`/EAS, React Navigation en vez de `expo-router`, punto de revisión que rechaza dependencias `expo-*` sin ADR, tabla de comandos para `pipeline.config.ps1` (Gradle, Jest, tsc, staging `comando` con APK/Maestro) y `expo/skills` retirada de las complementarias. En los proyectos ya inicializados: `.\kit.ps1 update`.

## 1.0.0
Primera versión del kit multiagente para GitHub Copilot, equivalente a `multiagent-kit` 1.6.0 de Claude Code.

- **Plugin** en formato Agent Plugins 1.0 (`plugins/multiagent-kit/plugin.json`) con marketplace `carlos-kits-copilot` en `marketplace.json` (raíz del repositorio). Instalación: `copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot` + `copilot plugin install multiagent-kit@carlos-kits-copilot`.
- **Agentes** (`com.github.copilot/agents/*.agent.md`): `director` (orquestador, nuevo), `product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`. Herramientas con alias de Copilot; sin memoria ni worktree por agente; skill de método leída al empezar.
- **Skills**: `pipeline`, `analisis`, `bugfix`, `ideas`, `retro-kit`, `deploy-staging`, `promote-prod`, `kit-init`, `metodo-{spec,adr,code-review,qa,deploy}`, `stack-{android,react-native,nestjs,ktor,db}`. Bloque "Cómo delegar (GitHub Copilot)" en las skills orquestadoras.
- **Proyecto** (`kit.ps1 init`): `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/kit.instructions.md`, `.github/copilot/settings.json` (auto-instala el plugin en CLI y cloud agent), `.github/workflows/copilot-setup-steps.yml`, prompts de VS Code (`.github/prompts/*.prompt.md`), copias gestionadas de agentes, skills y hooks con manifiesto de hashes (`.github/kit-manifest.json`) y comando `kit.ps1 update`.
- **Hooks** (`.github/hooks/kit.json` → `kit.ps1 hook …`): `session-start` (contexto + aviso de versión), `protect-main` (ramas protegidas, merge sin `VEREDICTO: APROBADO`, producción, comandos destructivos, `.env*`/keystores), `commit-gate` (lint + tests). Aceptan payload camelCase (CLI/cloud) y PascalCase (VS Code); denegación por JSON `permissionDecision` + exit 2. Requieren PowerShell 7 en Windows.
- **Scripts** de staging (`docker`, `compose`, `supabase`, `comando`, `ninguno`), smoke, promoción a producción con compuertas y estado v2, ahora multiplataforma (Windows y Linux) para el cloud agent.
- **Documentación**: 13 guías (instalación, publicar, usar, flujo, arquitectura viva, actualizar, problemas, superficies de Copilot, cloud agent y GitHub, Supabase, staging por proveedor, skills externas, diferencias con el kit de Claude).
