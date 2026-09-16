# 3. Usar el kit en un proyecto

Vale para un proyecto con código existente y para una carpeta vacía con solo una idea. Se hace desde la CLI de Copilot o desde VS Code; el resultado es el mismo.

## 3.1 Inicializar

```powershell
cd C:\ruta\a\tu\proyecto     # debe ser un repositorio git (git init si no lo es)
copilot
```

Dentro de Copilot:

```
/kit-init
```

(En VS Code: abre el chat en modo agente y ejecuta el prompt `/kit-init`, o en el terminal integrado `node <ruta del plugin>/scripts/cli.js init`.)

Crea dos tipos de archivo:

**Tuyos** (se crean si faltan y **nunca se sobrescriben**; si el kit trae una versión nueva queda al lado como `.kit`):

| Archivo | Para qué |
|---|---|
| `pipeline.config.json` | Comandos de instalar/build/test/lint, **proveedor de staging**, smoke, sub-repos, límites de tamaño. Lo único que rellenas. Ver [11-staging-por-proveedor.md](11-staging-por-proveedor.md). |
| `AGENTS.md` | Contexto del proyecto. Lo leen Copilot (CLI, VS Code, cloud agent) y todos los agentes. ≤ 40 líneas. |
| `.github/copilot-instructions.md` | Instrucciones cortas de Copilot para el repositorio (apuntan a `AGENTS.md` y a las compuertas). |
| `.github/copilot/settings.json` | Marketplace y plugin habilitados para este repositorio (la CLI y el cloud agent instalan el plugin solos). |
| `.github/workflows/copilot-setup-steps.yml` | Entorno del cloud agent (dependencias, Node). Ver [09](09-cloud-agent-y-github.md). |
| `staging/`, `docs/` | Compose y Dockerfile de staging; plantillas de spec, ADR, revisión de seguridad y arquitectura. |
| `.gitignore`, `.dockerignore` | Se fusionan: solo se añaden las líneas que falten. |

**Gestionados por el kit** (copias de lo que hay en el plugin, para que VS Code y el cloud agent las vean; se refrescan con `node kit.js update` mientras no los edites):

| Archivo | Para qué |
|---|---|
| `.github/agents/*.agent.md` | `director` y los 8 agentes. En VS Code aparecen como `@director`, `@arquitecto`… |
| `.github/skills/*/SKILL.md` | `/pipeline`, `/analisis`, `/bugfix`, `/ideas`, `/retro-kit`, `/deploy-staging`, `/promote-prod`, `/kit-init`, `metodo-*`, `stack-*`. |
| `.github/prompts/*.prompt.md` | Los comandos como prompts de VS Code (`/pipeline`, `/bugfix`…), que lanzan al agente `director`. |
| `.github/hooks/kit.json` | Hooks: ramas protegidas, secretos, compuerta de commit, contexto al iniciar sesión. |
| `.github/instructions/kit.instructions.md` | Reglas del kit aplicadas a todo archivo. |
| `.github/kit-manifest.json` | Versión y hashes de los archivos gestionados (para `update`). |
| `kit.js` | Lanzador de los scripts del plugin. |

Haz **commit de todo `.github/` y `kit.js`**: así el equipo y el cloud agent usan exactamente lo mismo.

## 3.2 Proyecto con código existente

1. Rellena `pipeline.config.json`. `/kit-init` mira tu código (`package.json`, `build.gradle.kts`, `pyproject.toml`…) y te propone los valores; confirma y los aplica.
2. Completa `AGENTS.md` con la descripción y convenciones del proyecto.
3. Verifica: `node kit.js check`.
4. Lanza tu primera feature:

```
/pipeline "Quiero que los usuarios puedan restablecer su contraseña por correo"
```

Los agentes no reescriben tu código: el arquitecto explora solo los módulos que la feature toca (y a partir de la primera feature, `docs/ARQUITECTURA.md`), y el implementador modifica únicamente los archivos del plan del ADR, en una rama `feature/*`.

## 3.3 Proyecto vacío, solo con la idea

```powershell
mkdir mi-proyecto; cd mi-proyecto; git init -b main
copilot
```

```
/kit-init
/pipeline "Una app para registrar los gastos del hogar con categorías y resumen mensual"
```

No hace falta rellenar `pipeline.config.json`. El pipeline detecta que no hay código y: el product-owner escribe la spec y tú la apruebas; el arquitecto propone **dos stacks** en `docs/adr/0000-stack.md` y **tú eliges**; el implementador hace el bootstrap y rellena `pipeline.config.json` y `AGENTS.md`; y sigue como en cualquier proyecto.

## 3.4 Comandos dentro de Copilot

En la **CLI** se invocan como skills (`/pipeline …`); en **VS Code** como prompts (`/pipeline` y rellenas la idea) o pidiéndoselo a `@director`. Ver [08-superficies-copilot.md](08-superficies-copilot.md).

| Comando | Qué hace |
|---|---|
| `/pipeline "idea"` | Flujo completo (ver [04-flujo-y-compuertas.md](04-flujo-y-compuertas.md)) |
| `/pipeline continuar <slug>` | Retoma un pipeline interrumpido |
| `/analisis "alcance o pregunta"` | Análisis de solo lectura (arquitectura, calidad, seguridad) con hallazgos priorizados en `docs/analisis/` |
| `/bugfix "descripción o traza"` | Reproducir → prueba roja → corregir en `fix/*` → QA → revisiones → staging. `--solo-diagnostico` para solo investigar; `--urgente` para hotfix con compuertas reducidas y registradas |
| `/ideas ["dirección"]` | Ideas equilibradas (producto + mercado + técnicas) priorizadas. `--producto`, `--mercado` (benchmark web con el investigador) o `--tecnico` |
| `/deploy-staging [slug]` | Solo desplegar la rama actual a staging y correr smoke tests |
| `/promote-prod` | Ver el estado de las compuertas para producción |
| `/retro-kit` | Retrospectiva del kit en este proyecto → `docs/kit-feedback/<fecha>.md` |
| `/kit-init` | Inicializar o actualizar el proyecto |
| `@director …` / `copilot --agent director` | El orquestador: entiende cualquiera de los comandos anteriores |
| `@product-owner …`, `@arquitecto …`, `@revisor-seguridad …` | Usar un agente suelto (VS Code); en la CLI `/agent` o `copilot --agent arquitecto -p "…"` |

## 3.5 ¿Qué comando para qué?

| Quieres… | Comando |
|---|---|
| Construir algo nuevo | `/pipeline "idea"` |
| Entender, auditar, saber si algo está listo | `/analisis "módulo o pregunta"` |
| Investigar un bug sin corregirlo | `/bugfix --solo-diagnostico "…"` |
| Corregir un bug con todas las garantías | `/bugfix "…"` |
| Hotfix urgente en producción | `/bugfix --urgente "…"` (te pedirá confirmar qué compuertas se omiten) |
| Que el equipo te proponga mejoras o nuevas funciones | `/ideas` (equilibrado), `/ideas --producto "para familias"`, `/ideas --tecnico` |
| Ver qué hacen productos parecidos y qué funciones adoptar | `/ideas --mercado "apps de hábitos para niños"` o `@investigador benchmark de …` |
| Una tarea puntual de un rol | `@arquitecto …`, `@revisor-seguridad …`, `@tester …` |
| Que Copilot lo haga en la nube a partir de un issue | Asignar el issue a Copilot en github.com (ver [09](09-cloud-agent-y-github.md)) |

`/analisis` e `/ideas` nunca tocan código: escriben en `docs/analisis/` y `docs/ideas/`. Los bugs corregidos dejan su causa raíz en `docs/RETRO.md`, que `/ideas` lee para proponer mejoras que ataquen causas recurrentes.

## 3.6 Comandos en la terminal (fuera de Copilot; iguales en Windows y macOS)

| Comando | Qué hace |
|---|---|
| `node kit.js check` | Verifica Node ≥ 18, Git, Copilot CLI, Docker/Supabase según proveedor, y la configuración |
| `node kit.js staging --feature <slug>` | Build + tests + desplegar a staging con el proveedor configurado |
| `node kit.js smoke` | Smoke tests contra staging |
| `node kit.js prod` | Promover a producción (pide escribir `PRODUCCION`) |
| `node kit.js init` | Re-ejecutar la inicialización (sin sobrescribir lo tuyo) |
| `node kit.js update` | Refrescar los archivos gestionados por el kit tras actualizar el plugin |
| `node kit.js migrate` | Convertir un `pipeline.config.ps1` antiguo en `pipeline.config.json` |
| `node kit.js version` | Versión del plugin y de los archivos del proyecto |
| `node kit.js status` | Estado del pipeline y compuertas; avisa de documentos demasiado largos |
| `node kit.js state clave=valor` | Actualiza el estado (lo usan los agentes; nunca se edita el JSON a mano) |

---
Anterior: [02-publicar-en-github.md](02-publicar-en-github.md) · Siguiente: [04-flujo-y-compuertas.md](04-flujo-y-compuertas.md) · [Índice](../README.md)
