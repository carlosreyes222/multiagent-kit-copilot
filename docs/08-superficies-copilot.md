# 8. Copilot CLI, VS Code y cloud agent

Copilot es un mismo modelo con tres "superficies" que leen configuraciones parecidas pero no idénticas. El kit está montado para que el **mismo repositorio** funcione en las tres.

## 8.1 Qué lee cada superficie

| Pieza del kit | Copilot CLI | VS Code | Cloud agent (github.com) |
|---|---|---|---|
| Agentes `.github/agents/*.agent.md` | ✔ (también los del plugin) | ✔ (`@nombre`) | ✔ (asignables a issues) |
| Skills `.github/skills/*/SKILL.md` | ✔ (`/nombre`, también las del plugin) | ✔ (se activan por descripción, o `#nombre`) | ✔ |
| Prompts `.github/prompts/*.prompt.md` | ✘ (usa las skills) | ✔ (`/pipeline`, `/bugfix`…) | ✘ |
| Hooks `.github/hooks/kit.json` | ✔ (`powershell`/`bash`) | ✔ (`command`/`windows.command`) | ✔ solo `bash` |
| `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` | ✔ | ✔ | ✔ |
| `.github/copilot/settings.json` (`enabledPlugins`) | ✔ instala el plugin solo | ✘ | ✔ instala el plugin solo |
| Plugin `multiagent-kit@carlos-kits-copilot` | ✔ | ✘ | ✔ (vía `enabledPlugins`) |
| Herramientas `web` del investigador | ✔ | ✔ | ✘ |
| Subagentes (delegación) | ✔ herramienta `task` / `agent` | ✔ `runSubagent` con los agentes de `agents:` | ✔ |

De ahí la regla del kit: **el plugin es la fuente; `kit.ps1 init` copia a `.github/` lo que VS Code y el cloud agent necesitan; `kit.ps1 update` lo refresca**.

## 8.2 Copilot CLI (terminal)

```powershell
cd mi-proyecto
copilot
```

- `/pipeline "idea"` — la skill se inyecta en la sesión y el agente principal delega en `product-owner`, `arquitecto`… con la herramienta `task`. También puedes arrancar directamente con el orquestador: `copilot --agent director` y escribir `pipeline "idea"`.
- `/agent` — elegir un agente del kit para la sesión (`arquitecto`, `revisor-seguridad`…). Equivale a `copilot --agent arquitecto`.
- No interactivo: `copilot --agent director -p "analisis ¿está listo el módulo de pagos?" --allow-all-tools` (ojo: `--allow-all-tools` no salta los hooks; el hook de ramas protegidas sigue denegando).
- `/skills list`, `/skills info pipeline`, `/skills reload` tras cambiar una skill.
- `/delegate <tarea>` (o `& <tarea>`) manda la tarea al cloud agent: abre una rama y un PR borrador y sigue en la nube aunque cierres el PC.
- Permisos: la CLI pregunta antes de ejecutar comandos; para denegar de forma fija algo además de los hooks: `copilot --deny-tool='shell(git push)'`.
- Ver a varios agentes trabajando: la CLI muestra los subagentes en la línea de tiempo; para sesiones paralelas por feature usa `/worktree feature/x` (crea un worktree y cambia a él).

## 8.3 VS Code

Requisitos: extensión GitHub Copilot Chat, chat en **modo agente**, y haber recargado la ventana tras `kit.ps1 init`.

- **Prompts**: escribe `/` en el chat y elige `pipeline`, `analisis`, `bugfix`, `ideas`, `deploy-staging`, `promote-prod`, `retro-kit`, `kit-init`. Cada prompt pide el argumento (idea, alcance, bug…) y lanza al agente `director`, que sigue la skill correspondiente y delega en los demás agentes (`runSubagent`).
- **Agentes sueltos**: `@arquitecto MODO: DOCUMENTAR`, `@revisor-seguridad revisa la rama actual`, `@investigador benchmark de apps de hábitos`.
- **Hooks**: VS Code lee `.github/hooks/kit.json` (formato `command` + `windows.command`). Los mismos scripts que en la CLI.
- **Skills**: se activan solas cuando su descripción encaja; para forzar una, menciónala (`usa la skill metodo-qa`).
- **Android Studio / JetBrains**: los agentes personalizados y las skills están en vista previa en los IDEs de JetBrains; los prompt files no. El kit debería funcionar allí con `@director pipeline "idea"`, pero no está probado.

## 8.4 Cloud agent (github.com)

El cloud agent trabaja en un sandbox de GitHub Actions: clona el repo, ejecuta `copilot-setup-steps.yml`, hace los cambios y abre un PR. Lee `AGENTS.md`, `.github/agents`, `.github/skills`, `.github/hooks` (solo `bash`) e instala el plugin si `.github/copilot/settings.json` lo habilita. No tiene búsqueda web ni pregunta nada: las compuertas humanas del pipeline se convierten en **revisión del PR**. Detalle y flujo con issues en [09-cloud-agent-y-github.md](09-cloud-agent-y-github.md).

## 8.5 Lo que cambia respecto al terminal de Claude Code

- No hay `$ARGUMENTS`: la skill recibe el texto que acompaña a `/pipeline …`. En VS Code el prompt lo pide con `${input:…}`.
- No hay `memory: project` ni `isolation: worktree` por agente: la memoria es `docs/ARQUITECTURA.md`; el aislamiento es la rama `feature/*` (y `/worktree` si lo quieres).
- Los permisos "allow/deny" por comando no existen en el repo: los hooks del kit hacen de lista de denegación (producción, destructivos, secretos, ramas protegidas), y la CLI pregunta lo demás.
- Los modelos por agente no vienen fijados; heredan el de la sesión. Puedes fijarlos con `model:` en cada `.agent.md` (ver [04](04-flujo-y-compuertas.md) §4.2).

---
Anterior: [07-problemas-frecuentes.md](07-problemas-frecuentes.md) · Siguiente: [09-cloud-agent-y-github.md](09-cloud-agent-y-github.md) · [Índice](../README.md)
