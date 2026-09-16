# 13. Diferencias con el kit de Claude Code

Los dos kits comparten el diseño (agentes, compuertas, skills de método y de stack, scripts de staging y estado). Esta tabla resume lo que cambia y por qué, para mantenerlos a la par.

| Tema | `multiagent-kit` (Claude Code) | `multiagent-kit-copilot` |
|---|---|---|
| Distribución | Plugin en marketplace `.claude-plugin/`; nada se copia al proyecto salvo config | Plugin Agent Plugins 1.0 en `.github/plugin/`; `kit.ps1 init` copia agentes, skills, prompts y hooks a `.github/` porque VS Code y el cloud agent solo leen el repo |
| Actualizar | `/plugin update` y listo | `copilot plugin update` **y** `kit.ps1 update` en cada proyecto (con manifiesto de hashes para no pisar tus cambios) |
| Agentes | `agents/*.md` con `tools` de Claude, `model`, `memory: project`, `isolation: worktree`, `skills:` precargadas | `com.github.copilot/agents/*.agent.md` con alias `read/search/edit/execute/web/agent`; sin memoria ni worktree; la skill de método se lee al empezar; agente extra `director` como orquestador |
| Orquestación | El propio Claude sigue la skill `/pipeline` y lanza subagentes con `Task` | Igual en la CLI (`task`); en VS Code los prompts lanzan a `director`, que delega con `runSubagent` a los agentes listados en `agents:` |
| Comandos | Skills con `$ARGUMENTS`; `/multiagent-kit:init` | Skills que reciben el texto de la invocación; `/kit-init` (`/init` es un comando propio de Copilot); prompts `.prompt.md` para VS Code |
| Contexto del proyecto | `CLAUDE.md` | `AGENTS.md` + `.github/copilot-instructions.md` + `.github/instructions/kit.instructions.md` |
| Hooks | `hooks/hooks.json` del plugin, `powershell.exe`, exit 2 | `.github/hooks/kit.json` del proyecto → `kit.ps1 hook <nombre>` → script del plugin; **PowerShell 7** obligatorio en Windows; stdout JSON `permissionDecision` + exit 2; scripts aceptan los payloads camelCase y PascalCase |
| Permisos | `allow/deny` en `.claude/settings.json` | No existe lista de denegación por repositorio: el hook `protect-main` deniega producción, comandos destructivos y secretos; la CLI pregunta el resto |
| Memoria de agentes | `memory: project` en arquitecto y revisores | Solo `docs/ARQUITECTURA.md` y `docs/reviews/` |
| Búsqueda web (investigador) | `WebSearch`/`WebFetch` | `web` en CLI y VS Code; no disponible en el cloud agent |
| Modelos | `sonnet`/`opus` por agente | Heredan el de la sesión; opcional `model:` con IDs de Copilot |
| Multiplataforma | Windows | Scripts probados en Windows y Linux (`cmd` / `sh` según sistema) para que los hooks corran en el cloud agent |
| Ejecución en la nube | No aplica | Cloud agent con `copilot-setup-steps.yml`; compuertas humanas → revisión del PR; rulesets de GitHub como barrera final |

## Mantener los dos kits a la par

Cuando cambies algo en uno, pásalo al otro con estas equivalencias:

- Un cambio en el **cuerpo** de un agente o de una skill se copia casi literal (ajusta `CLAUDE.md`↔`AGENTS.md`, `/multiagent-kit:init`↔`/kit-init`, `$ARGUMENTS`↔"la petición del usuario").
- Un cambio en **scripts** (`_common`, staging, smoke, prod, state) se copia tal cual; en el kit de Copilot mantén las rutas con `/` y las llamadas a `cmd`/`sh` condicionadas por sistema.
- Un cambio en **hooks**: en Claude va en `hooks/hooks.json`; en Copilot en `templates/github/hooks/kit.json` y en los scripts `protect-main`/`commit-gate`/`session-start`, que leen el evento con `_hook-common.ps1`.
- Sube la versión en los dos manifiestos de cada kit y anótalo en ambos `CHANGELOG.md`.

---
Anterior: [12-skills-y-plugins-externos.md](12-skills-y-plugins-externos.md) · [Índice](../README.md)
