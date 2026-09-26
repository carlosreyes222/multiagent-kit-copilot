# bkit — kit de agentes para GitHub Copilot

Un equipo de agentes de GitHub Copilot para apps **React Native bare** (CLI, TypeScript, sin Expo) que lleva una idea desde la especificación hasta un **pull request** listo para revisar: spec aprobada por ti, ADR, código en rama con el ticket de Jira, QA, revisión de código y de seguridad, y el PR abierto contra la rama base que indiques. El merge, el tren de release y el despliegue siguen siendo del equipo. Es el hermano del kit `multiagent-kit` de Claude Code, recortado para el trabajo: mismos agentes y compuertas, sin staging ni producción.

Funciona en **Copilot CLI** (terminal) y **VS Code** (agent mode, `@agentes`, `/prompts`). Se distribuye como **plugin de Copilot** con marketplace propio. **Nada del kit queda en el repositorio**: agentes, skills, prompts y hooks se instalan en tu perfil de usuario; en el proyecto solo quedan `pipeline.config.json`, `AGENTS.md` y `.pipeline/` (fuera de git) y los documentos que producen los agentes: solo `docs/ARQUITECTURA.md` se versiona; specs, ADR e informes quedan fuera de git, el PR lleva su resumen y al cerrar la feature se archivan en tu perfil (`~/.multiagent-kit/archivo/`).

```
idea ──► product-owner ──► arquitecto ──► implementador ──► tester ──► revisor-codigo ┐
          (spec)  ▲          (ADR)      (feature/TICKET-…)    (QA)    revisor-seguridad ┴─► arquitecto (documenta) ──► release-manager ──► PULL REQUEST
       compuerta humana                                                (VEREDICTO)          (ARQUITECTURA.md)                               │
                                                                                                                         el equipo: revisión, merge, release
```

## Guías

| # | Guía | Cuándo leerla |
|---|---|---|
| 1 | [Instalación (Windows y macOS)](docs/01-instalacion-windows.md) | Primera vez en un PC: Node, Git, Copilot CLI, VS Code, plugin |
| 2 | [Publicar el kit en GitHub](docs/02-publicar-en-github.md) | Una sola vez, para que los proyectos lo instalen desde tu repositorio |
| 3 | [Usar el kit en un proyecto](docs/03-usar-en-un-proyecto.md) | Cada proyecto nuevo o existente: `/kit-init`, comandos, qué comando para qué |
| 4 | [El flujo, los agentes y las compuertas](docs/04-flujo-y-compuertas.md) | Entender qué hace cada agente y dónde intervienes tú |
| 5 | [Arquitectura viva](docs/05-arquitectura-viva.md) | Cómo los agentes no releen el proyecto entero en cada feature |
| 6 | [Actualizar el kit](docs/06-actualizar-el-kit.md) | Publicar versiones y recibirlas en todos los proyectos |
| 7 | [Problemas frecuentes](docs/07-problemas-frecuentes.md) | Cuando algo no funciona |
| 8 | [Copilot CLI, VS Code y cloud agent](docs/08-superficies-copilot.md) | Qué funciona en cada superficie y cómo se usa el kit en cada una |
| 9 | [GitHub: reglas y pull request](docs/09-cloud-agent-y-github.md) | Rulesets como barrera final, el PR que abre el kit, qué pasa cuando la revisión pide cambios |
| 10 | [Skill de stack y skills externas](docs/10-skills-y-plugins-externos.md) | React Native bare: convenciones del equipo; skills de terceros recomendadas |
| 11 | [Diferencias con el kit de Claude Code](docs/11-diferencias-con-claude.md) | Qué cambia y por qué; cómo mantener los dos kits |
| 12 | [SDKs del equipo y flujo end-to-end](docs/12-sdks-y-end-to-end.md) | SDK propio (npm, Android/Maven, iOS) como contexto y `/pipeline --sdk` de extremo a extremo con versión de trabajo local |

## Resumen en cinco comandos

```bash
# 1. Una vez por PC (cualquier terminal, Windows o macOS)
copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot
copilot plugin install bkit@bkit

# 2. En cada proyecto (dentro de `copilot`, o con el prompt /kit-init en VS Code)
/kit-init              # deja solo pipeline.config.json, el contexto y .pipeline/ (fuera de git); instala el comando global `kit`

# 3. Trabajar
/pipeline "Quiero que los usuarios puedan restablecer su contraseña por correo"

# 4. Cuando el PR está abierto
#    revisión del equipo, merge y tren de release, fuera del kit
```

## Dónde se usa cada cosa

- **VS Code** (chat en modo agente): los flujos del día a día, `/pipeline`, `/bugfix`, `/analisis`, `/ideas` y `@agente …`.
- **Terminal** (la integrada de VS Code sirve, PowerShell o zsh): los comandos de Node.js del kit, `kit check`, `kit status`, `kit doctor`, `kit update`, `kit epica …`, `kit sdk …`.
- **Copilot CLI**: instalar y actualizar el plugin, que VS Code y el comando `kit` usan aunque no abras la CLI.

## Qué protege el kit

Los hooks revisan cada comando y cada lectura o edición de los agentes en VS Code y en la CLI, con un parser que entiende sh, cmd y PowerShell. Bloquean:

- push y commit en ramas protegidas (admite `release_*`) y los push forzados;
- borrados recursivos y descartes de trabajo;
- `gh pr merge`;
- la lectura, copia o versionado de secretos y material de firma de Android e iOS;
- commits y ramas sin el ticket de Jira.

`kit pr` solo abre el PR si cada informe tiene un único veredicto APROBADO y revisó el código actual. Detalle en [04 §4.3](docs/04-flujo-y-compuertas.md). Son una defensa en profundidad: la barrera final son las reglas del repositorio en GitHub ([09](docs/09-cloud-agent-y-github.md)).

## Desarrollo del kit

```bash
npm test        # node --test: hooks, compuerta de commit, estado concurrente, kit pr, lanzadores (Node ≥ 18, sin dependencias)
```

GitHub Actions repite las pruebas en Windows, macOS y Linux en cada push y PR (`.github/workflows/test.yml`). Antes de publicar una versión: [06 §6.2](docs/06-actualizar-el-kit.md).

## Estructura del repositorio

```
multiagent-kit-copilot/
├── marketplace.json                    ← marketplace "bkit"
├── plugins/bkit/
│   ├── plugin.json                     ← manifiesto Agent Plugins 1.0 (versión)
│   ├── skills/                         ← /pipeline, /analisis, /bugfix, /ideas, /retro-kit, /kit-init, metodo-*, stack-react-native
│   ├── com.github.copilot/agents/      ← director + 8 agentes (*.agent.md)
│   ├── scripts/                        ← Node.js: init/update, hooks, pr, sdk, epica, doctor, estado, lanzadores
│   └── templates/                      ← config, AGENTS.md, plantillas de docs, prompts e instrucciones de VS Code (van al perfil)
├── test/                               ← pruebas del kit (npm test); no forman parte del plugin
├── .github/workflows/test.yml          ← CI de las pruebas (Windows, macOS, Linux)
├── docs/                               ← estas guías
└── CHANGELOG.md
```

Licencia MIT.
