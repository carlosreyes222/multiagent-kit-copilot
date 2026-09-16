# multiagent-kit para GitHub Copilot

Un equipo de agentes de GitHub Copilot que lleva una idea desde la especificación hasta un ambiente de pruebas, con compuertas de calidad y seguridad, y deja la promoción a producción en manos de una persona. Es el equivalente para Copilot del kit [`multiagent-kit`](https://github.com/carlosreyes222/multiagent-kit) de Claude Code: mismos agentes, mismas skills de método y de stack, mismos scripts de staging, mismas compuertas.

Funciona en las tres superficies de Copilot: **Copilot CLI** (terminal), **VS Code** (agent mode, `@agentes`, `/prompts`) y el **cloud agent de github.com** (asignar un issue a Copilot). Se distribuye como **plugin de Copilot** con marketplace propio; `node kit.js init` deja en cada proyecto la copia de `.github/` que VS Code y el cloud agent necesitan, y `node kit.js update` la refresca. En repositorios ajenos, `--modo usuario` instala todo en tu perfil y no deja nada en git.

```
idea ──► product-owner ──► arquitecto ──► implementador ──► tester ──► revisor-codigo ┐
          (spec)  ▲          (ADR)          (feature/*)       (QA)    revisor-seguridad ┴─► release-manager ──► STAGING ──► arquitecto (documenta) ──► TÚ: kit.js prod
       compuerta humana                                                (VEREDICTO)
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
| 10 | [Supabase como backend](docs/10-supabase.md) | Staging y producción en dos proyectos Supabase con la CLI |
| 11 | [Staging por proveedor](docs/11-staging-por-proveedor.md) | `docker`, `compose`, `supabase`, `comando`, `ninguno` |
| 12 | [Skills de stack y skills externas](docs/12-skills-y-plugins-externos.md) | Android, React Native, NestJS, Ktor, bases de datos; skills de terceros |
| 13 | [Diferencias con el kit de Claude Code](docs/13-diferencias-con-claude.md) | Qué cambia y por qué; cómo mantener los dos kits |
| 14 | [SDKs del equipo y flujo end-to-end](docs/14-sdks-y-end-to-end.md) | SDK propio (npm, Android/Maven, iOS) como contexto y `/pipeline --sdk` de extremo a extremo con versión de trabajo local |

## Resumen en cinco comandos

```bash
# 1. Una vez por PC (cualquier terminal, Windows o macOS)
copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot
copilot plugin install multiagent-kit@carlos-kits-copilot

# 2. En cada proyecto (dentro de `copilot`, o con el prompt /kit-init en VS Code)
/kit-init

# 3. Trabajar
/pipeline "Quiero que los usuarios puedan restablecer su contraseña por correo"

# 4. Cuando staging está en verde y lo has probado tú
node kit.js prod
```

## Estructura del repositorio

```
multiagent-kit-copilot/
├── marketplace.json                    ← marketplace "carlos-kits-copilot"
├── plugins/multiagent-kit/
│   ├── plugin.json                     ← manifiesto Agent Plugins 1.0 (versión)
│   ├── skills/                         ← /pipeline, /analisis, /bugfix, /ideas, /retro-kit, /deploy-staging, /promote-prod, /kit-init,
│   │                                      metodo-*, stack-*
│   ├── com.github.copilot/agents/      ← director + 8 agentes (*.agent.md)
│   ├── scripts/                        ← Node.js: init/update, hooks, staging, smoke, prod, estado
│   └── templates/                      ← lo que init copia a cada proyecto (AGENTS.md, .github/, kit.js, staging/, docs/)
├── docs/                               ← estas guías
└── CHANGELOG.md
```

Licencia MIT.
