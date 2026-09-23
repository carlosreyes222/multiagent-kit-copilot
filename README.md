# multiagent-kit para GitHub Copilot

Un equipo de agentes de GitHub Copilot para apps **React Native bare** (CLI, TypeScript, sin Expo) que lleva una idea desde la especificación hasta un **pull request** listo para revisar: spec aprobada por ti, ADR, código en rama con el ticket de Jira, QA, revisión de código y de seguridad, y el PR abierto contra la rama base que indiques. El merge, el tren de release y el despliegue siguen siendo del equipo. Es el hermano del kit [`multiagent-kit`](https://github.com/carlosreyes222/multiagent-kit) de Claude Code, recortado para el trabajo: mismos agentes y compuertas, sin staging ni producción.

Funciona en **Copilot CLI** (terminal) y **VS Code** (agent mode, `@agentes`, `/prompts`); el cloud agent de github.com solo con el modo `repo`. Se distribuye como **plugin de Copilot** con marketplace propio; `kit init` deja en el proyecto solo `pipeline.config.json`, `AGENTS.md` y `.pipeline/` (fuera de git) e instala el comando global `kit`.

```
idea ──► product-owner ──► arquitecto ──► implementador ──► tester ──► revisor-codigo ┐
          (spec)  ▲          (ADR)      (feature/TICKET-…)    (QA)    revisor-seguridad ┴─► release-manager ──► PULL REQUEST ──► arquitecto (documenta)
       compuerta humana                                                (VEREDICTO)                                    │
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
| 9 | [Cloud agent y GitHub](docs/09-cloud-agent-y-github.md) | Asignar issues a Copilot, `copilot-setup-steps`, rulesets, code review automático |
| 10 | [Skill de stack y skills externas](docs/10-skills-y-plugins-externos.md) | React Native bare: convenciones del equipo; skills de terceros recomendadas |
| 11 | [Diferencias con el kit de Claude Code](docs/11-diferencias-con-claude.md) | Qué cambia y por qué; cómo mantener los dos kits |
| 12 | [SDKs del equipo y flujo end-to-end](docs/12-sdks-y-end-to-end.md) | SDK propio (npm, Android/Maven, iOS) como contexto y `/pipeline --sdk` de extremo a extremo con versión de trabajo local |

## Resumen en cinco comandos

```bash
# 1. Una vez por PC (cualquier terminal, Windows o macOS)
copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot
copilot plugin install multiagent-kit@carlos-kits-copilot

# 2. En cada proyecto (dentro de `copilot`, o con el prompt /kit-init en VS Code)
/kit-init              # deja solo pipeline.config.json, el contexto y .pipeline/ (fuera de git); instala el comando global `kit`

# 3. Trabajar
/pipeline "Quiero que los usuarios puedan restablecer su contraseña por correo"

# 4. Cuando el PR está abierto
#    revisión del equipo, merge y tren de release, fuera del kit
```

## Estructura del repositorio

```
multiagent-kit-copilot/
├── marketplace.json                    ← marketplace "carlos-kits-copilot"
├── plugins/multiagent-kit/
│   ├── plugin.json                     ← manifiesto Agent Plugins 1.0 (versión)
│   ├── skills/                         ← /pipeline, /analisis, /bugfix, /ideas, /retro-kit, /kit-init, metodo-*, stack-react-native
│   ├── com.github.copilot/agents/      ← director + 8 agentes (*.agent.md)
│   ├── scripts/                        ← Node.js: init/update, hooks, pr, sdk, epica, doctor, estado
│   └── templates/                      ← config, AGENTS.md, plantillas de docs y .github/ (modo repo)
├── docs/                               ← estas guías
└── CHANGELOG.md
```

Licencia MIT.
