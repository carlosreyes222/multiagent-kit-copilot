# 8. VS Code, Copilot CLI y la terminal

## 8.0 Reparto recomendado

| Dónde | Qué haces ahí |
|---|---|
| **VS Code** (chat en modo agente) | El trabajo diario con los agentes: `/pipeline`, `/bugfix`, `/analisis`, `/ideas`, `/retro-kit`, `/kit-init` y `@arquitecto …`, `@revisor-seguridad …` |
| **Terminal** (la integrada de VS Code sirve: PowerShell en Windows, zsh en macOS) | Los comandos de Node.js del kit: `kit check`, `kit status`, `kit doctor`, `kit update`, `kit epica …`, `kit sdk …`, `kit lecciones`, y los pasos humanos (`kit sdk publish`) |
| **Copilot CLI** (`copilot`) | Instalar y actualizar el plugin (`copilot plugin install/update`); opcionalmente, los mismos flujos que en VS Code |

Los agentes también ejecutan comandos `kit …` (`kit state`, `kit pr`, `kit plantilla`) desde su terminal; tú no necesitas lanzarlos.

## 8.1 Qué lee cada superficie

`kit init` / `kit update` instalan todo en tu **perfil de usuario**; en el proyecto no queda nada del kit ([03 §3.7](03-usar-en-un-proyecto.md)).

| Pieza del kit | VS Code | Copilot CLI |
|---|---|---|
| Agentes | `User/prompts/*.agent.md` (`@director`, `@arquitecto`…) | `~/.copilot/agents/*.agent.md` (y los del plugin) |
| Skills (`metodo-*`, `stack-react-native`…) | `~/.copilot/skills/` (se activan por descripción, o `#nombre`) | `~/.copilot/skills/` y las del plugin (`/nombre`) |
| Prompts `/pipeline`, `/bugfix`… | `User/prompts/*.prompt.md` | ✘ (usa las skills) |
| Instrucciones del kit | `User/prompts/kit.instructions.md` + `AGENTS.md` del proyecto | `AGENTS.md` del proyecto |
| Hooks (`protect-main`, `commit-gate`, `session-start`) | `~/.copilot/hooks/bkit.json` → `~/.copilot/bkit-hook.js` | igual |
| Plugin `bkit@bkit` | no se instala en VS Code; los hooks y `kit` usan el que instaló la CLI | ✔ |
| Herramientas `web` del investigador | ✔ | ✔ |
| Subagentes (delegación) | `runSubagent` con los agentes de `agents:` | herramienta `task` / `agent` |

Por eso **la CLI tiene que estar instalada aunque trabajes solo en VS Code**: el plugin vive en `~/.copilot/installed-plugins/`, y de ahí lo toman los hooks y el comando `kit`. El lanzador de hooks lleva dentro la ruta del plugin que lo instaló y, si esa ruta ya no existe, busca el plugin de Copilot con la versión más alta. **Nunca usa el plugin del kit de Claude Code**, aunque esté instalado y sea más reciente.

## 8.2 Copilot CLI (terminal)

```bash
cd mi-proyecto
copilot
```

- `/pipeline "idea"` — la skill se inyecta en la sesión y el agente principal delega en `product-owner`, `arquitecto`… con la herramienta `task`. También puedes arrancar directamente con el orquestador: `copilot --agent director` y escribir `pipeline "idea"`.
- `/agent` — elegir un agente del kit para la sesión (`arquitecto`, `revisor-seguridad`…). Equivale a `copilot --agent arquitecto`.
- No interactivo: `copilot --agent director -p "analisis ¿está listo el módulo de pagos?" --allow-all-tools` (ojo: `--allow-all-tools` no salta los hooks; el hook de ramas protegidas sigue denegando).
- `/skills list`, `/skills info pipeline`, `/skills reload` tras cambiar una skill.
- `/delegate <tarea>` (o `& <tarea>`) manda la tarea al cloud agent, que **no** tiene el kit (ni agentes, ni hooks, ni compuertas): no lo uses para features del pipeline (ver §8.4).
- Permisos: la CLI pregunta antes de ejecutar comandos; para denegar de forma fija algo además de los hooks: `copilot --deny-tool='shell(git push)'`.
- Ver a varios agentes trabajando: la CLI muestra los subagentes en la línea de tiempo; para sesiones paralelas por feature usa `/worktree feature/x` (crea un worktree y cambia a él).

## 8.3 VS Code

Requisitos: extensión GitHub Copilot Chat, chat en **modo agente**, y haber recargado la ventana (*Developer: Reload Window*) tras `kit init` o `kit update`.

- **Prompts**: escribe `/` en el chat y elige `pipeline`, `analisis`, `bugfix`, `ideas`, `retro-kit` o `kit-init`. Cada prompt pide el argumento (idea, alcance, bug…) y lanza al agente `director`, que sigue la skill correspondiente y delega en los demás agentes (`runSubagent`).
- **Agentes sueltos**: `@arquitecto MODO: DOCUMENTAR`, `@revisor-seguridad revisa la rama actual`, `@investigador benchmark de apps de hábitos`.
- **Hooks**: VS Code lee `~/.copilot/hooks/bkit.json`, con los mismos scripts que la CLI. Reconocen las herramientas de VS Code: `run_in_terminal` (comandos), `read_file` (lecturas) y `create_file`, `replace_string_in_file`, `multi_replace_string_in_file`, `insert_edit_into_file` y `apply_patch` (ediciones). Los comandos se analizan con un parser que entiende PowerShell, que es el terminal por defecto de VS Code en Windows: `Remove-Item -Recurse`, `Get-Content .env`, `pwsh -Command "…"` o `-EncodedCommand` se tratan igual que sus equivalentes de sh (tabla completa en [04 §4.3](04-flujo-y-compuertas.md)). Cuando el hook bloquea, el agente ve el motivo en el chat y suele proponer la alternativa permitida.
- **Skills**: se activan solas cuando su descripción encaja; para forzar una, menciónala (`usa la skill metodo-qa`).
- **Android Studio / JetBrains**: los agentes personalizados y las skills están en vista previa en los IDEs de JetBrains; los prompt files no. El kit debería funcionar allí con `@director pipeline "idea"`, pero no está probado.

## 8.4 Cloud agent (github.com)

No se usa con este kit: el cloud agent solo lee agentes y skills que estén dentro del repositorio, y este kit no deja nada del kit en el repo por decisión de diseño. Las reglas del repositorio en GitHub (rulesets, revisiones obligatorias) siguen siendo la barrera final del PR ([09](09-cloud-agent-y-github.md)).

## 8.5 Lo que cambia respecto al terminal de Claude Code

- No hay `$ARGUMENTS`: la skill recibe el texto que acompaña a `/pipeline …`. En VS Code el prompt lo pide con `${input:…}`.
- No hay `memory: project` ni `isolation: worktree` por agente: la memoria es `docs/ARQUITECTURA.md`; el aislamiento es la rama `feature/*` (y `/worktree` si lo quieres).
- Los permisos "allow/deny" por comando no existen en el repo: los hooks del kit hacen de lista de denegación (destructivos, secretos, ramas protegidas, merge), y VS Code o la CLI preguntan lo demás.
- Los scripts son Node.js (no PowerShell): `kit …` funciona igual desde PowerShell, cmd, Git Bash o zsh, en Windows, macOS y Linux.
- Los modelos por agente no vienen fijados; heredan el de la sesión. Puedes fijarlos con `model:` en cada `.agent.md` (ver [04](04-flujo-y-compuertas.md) §4.2).

---
Anterior: [07-problemas-frecuentes.md](07-problemas-frecuentes.md) · Siguiente: [09-cloud-agent-y-github.md](09-cloud-agent-y-github.md) · [Índice](../README.md)
