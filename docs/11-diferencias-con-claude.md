# 11. Diferencias con el kit de Claude Code

Los dos kits comparten el núcleo (agentes, compuertas, skills de método, scripts de estado, SDKs, épicas, doctor) pero tienen alcance distinto: el de Claude es general (cualquier stack, staging por proveedor y promoción manual a producción); el de Copilot está recortado para el trabajo: **solo React Native bare** y el flujo **termina en el pull request**. Esta tabla resume lo que cambia y por qué.

| Tema | `multiagent-kit` (Claude Code) | `multiagent-kit-copilot` |
|---|---|---|
| Alcance | Cualquier stack (Android, RN, NestJS, Ktor, bases de datos) | Solo React Native bare (CLI, sin Expo) |
| Fin del flujo | Staging (`docker`, `compose`, `supabase`, `comando`, `ninguno`) → smoke → `kit prod` (persona) | Pull request contra la rama base que eliges (`kit pr`); merge y release del equipo |
| Ramas y commits | `feature/<slug>`, commits libres | `feature/TICKET-<slug>` y commits `<tipo>: TICKET …` exigidos por el hook |
| Distribución | Plugin en marketplace `.claude-plugin/`; modos `usuario` (por defecto), `local` y `repo` | Plugin Agent Plugins 1.0 en la raíz; **solo modo usuario**: agentes, skills, prompts y hooks en `~/.copilot/` y el perfil de VS Code; nada en el repo |
| Actualizar | `/plugin update` + `kit update` | `copilot plugin update` + `kit update` (refresca el perfil con manifiesto de hashes) |
| Agentes | `agents/*.md` con `tools` de Claude, `model`, `memory: project`, `isolation: worktree`, `skills:` precargadas | `com.github.copilot/agents/*.agent.md` con alias `read/search/edit/execute/web/agent`; sin memoria ni worktree; la skill de método se lee al empezar; agente extra `director` como orquestador |
| Orquestación | El propio Claude sigue la skill `/pipeline` y lanza subagentes con `Task` | Igual en la CLI (`task`); en VS Code los prompts lanzan a `director`, que delega con `runSubagent` a los agentes listados en `agents:` |
| Comandos | Skills con `$ARGUMENTS`; `/multiagent-kit:init` | Skills que reciben el texto de la invocación; `/kit-init` (`/init` es un comando propio de Copilot); prompts `.prompt.md` para VS Code |
| Contexto del proyecto | `CLAUDE.md` | `AGENTS.md` (proyecto, fuera de git) + `kit.instructions.md` en el perfil de VS Code |
| Hooks | `hooks/hooks.json` del plugin → `node scripts/hook.js <nombre>`; exit 2 + stderr | `~/.copilot/hooks/multiagent-kit.json` (usuario) → lanzador `~/.copilot/multiagent-kit-hook.js` (solo plugin de Copilot) → `scripts/hook.js` del plugin; stdout JSON `permissionDecision` (+ `hookSpecificOutput` para VS Code) + exit 2; solo actúa en carpetas con `pipeline.config.json`. El mismo `hook.js` entiende los payloads de Claude/VS Code (`tool_name`, `run_in_terminal`, `read_file`…) y de Copilot CLI (`toolName`, `bash`, `powershell`, `write_bash`…) |
| Permisos | `allow/deny` en `.claude/settings.json` | No existe lista de denegación por repositorio: el hook `protect-main` deniega producción, comandos destructivos y secretos; la CLI pregunta el resto |
| Memoria de agentes | `memory: project` en arquitecto y revisores | Solo `docs/ARQUITECTURA.md` y `docs/reviews/` |
| Búsqueda web (investigador) | `WebSearch`/`WebFetch` | `web` en CLI y VS Code; no disponible en el cloud agent |
| Modelos | `sonnet`/`opus` por agente | Heredan el de la sesión; opcional `model:` con IDs de Copilot |
| Multiplataforma | Scripts Node.js (Windows, macOS, Linux) | Igual; el hook entiende además PowerShell y cmd (terminal de VS Code en Windows) |
| Ejecución en la nube | No aplica | No aplica: el cloud agent necesita agentes en el repo y este kit no deja nada allí |

## Mantener los dos kits a la par

Cuando cambies algo en uno, pásalo al otro con estas equivalencias:

- Un cambio en el **cuerpo** de un agente o de una skill se copia casi literal (ajusta `CLAUDE.md`↔`AGENTS.md`, `/multiagent-kit:init`↔`/kit-init`, `$ARGUMENTS`↔"la petición del usuario").
- Los **scripts** (`scripts/*.js`, `templates/kit.js`, `templates/pipeline.config.json`) son idénticos en los dos kits: copia la carpeta entera de uno a otro; `common.js` detecta el sabor por la ubicación de `plugin.json`.
- Los **hooks** viven en `scripts/hook.js` (común). Solo cambia quién los declara: `hooks/hooks.json` en Claude; en Copilot los genera `scripts/user-install.js` en `~/.copilot/hooks/multiagent-kit.json`.
- Los **lanzadores** que viven fuera del plugin (comando global `kit` en `~/.multiagent-kit/bin/` y lanzador de hooks) salen de `scripts/launcher-src.js`. El comando `kit` **es el mismo archivo para los dos kits**: lo regenera el `kit update` de cualquiera de ellos. Por eso los dos kits deben llevar la misma versión de `launcher-src.js`, que elige el plugin por el sabor del proyecto (`AGENTS.md` → Copilot, `CLAUDE.md` → Claude) y no por fecha. Si uno de los kits se queda con un lanzador antiguo, cada `kit update` de ese kit lo vuelve a sustituir.
- Las **pruebas** (`test/`, `npm test`) valen para los dos kits: `KIT_TEST_PLUGIN=<ruta al plugin de Claude> npm test` ejecuta la batería contra el otro kit (las de `kit pr` solo aplican a Copilot).
- Sube la versión en los dos manifiestos de cada kit y anótalo en ambos `CHANGELOG.md`.

**Pendiente en el kit de Claude (a fecha de la 2.1.0 de este kit):** copiar `scripts/hook.js`, `common.js`, `state.js`, `epica.js`, `launcher-src.js`, `global-install.js` y `test/`. Hasta entonces, con los dos kits instalados, el `kit update` del kit de Claude reescribe el comando global `kit` con el lanzador antiguo, que elige el plugin por fecha.

---
Anterior: [10-skills-y-plugins-externos.md](10-skills-y-plugins-externos.md) · Siguiente: [12-sdks-y-end-to-end.md](12-sdks-y-end-to-end.md) · [Índice](../README.md)
