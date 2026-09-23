# 3. Usar el kit en un proyecto

Vale para un proyecto con código existente y para una carpeta vacía con solo una idea. Se hace desde la CLI de Copilot o desde VS Code; el resultado es el mismo.

## 3.1 Inicializar

```powershell
cd C:\ruta\a\tu\proyecto     # debe ser un repositorio git (git init si no lo es)
copilot
```

Dentro de Copilot: `/kit-init` (o en la terminal, si ya tienes el comando global: `kit init`). No hay modos que elegir: nada del kit se copia al repositorio.

**En el proyecto solo quedan tres cosas**, y las tres van a `.git/info/exclude` (privado de tu clon, nunca se suben):

| Archivo | Para qué |
|---|---|
| `pipeline.config.json` | Comandos de instalar/build/test/lint (viene con los de una app RN: `npm ci`, `tsc --noEmit`, `npm test`, `npm run lint`), sub-repos, SDKs, ramas protegidas, límites. Lo único que rellenas. |
| `AGENTS.md` | Contexto del proyecto que leen todos los agentes. Si quieres compartirlo con el equipo, quítalo del exclude y versiónalo. |
| `.pipeline/` | Estado del pipeline, manifiesto del kit, SDKs sincronizados, historial. |

Lo que los agentes producen (`docs/specs`, `docs/adr`, `docs/reviews`, `docs/epicas`, `docs/ARQUITECTURA.md`) sí es del proyecto y se versiona como cualquier documento.

**Todo lo demás es global por máquina** y lo instala el propio `init` la primera vez (y refresca `kit update`):

| Dónde | Qué |
|---|---|
| `~/.multiagent-kit/bin/` | El comando **`kit`** (`kit check`, `kit status`, `kit pr`…). `init` lo añade al PATH del usuario (Windows: variable de entorno; macOS/Linux: tu `.zshrc`/`.bashrc`); abre una terminal nueva la primera vez. |
| `~/.multiagent-kit/` | Caché de versión y `lecciones.md` compartidas entre proyectos. |
| Plugin | Plantillas de spec, ADR, revisión de seguridad y arquitectura (`kit plantilla <spec|adr|seguridad|arquitectura>` dice la ruta). Si un proyecto quiere una plantilla propia, la pone en `docs/…/_PLANTILLA*.md` y tiene prioridad. |
| `~/.copilot/{agents,skills,hooks}` y `User/prompts` de VS Code | Agentes, skills, hooks y prompts del kit (ver [08](08-superficies-copilot.md)). |

Si un archivo tuyo ya existía (por ejemplo tu propio `AGENTS.md`), no se toca y la versión del kit queda al lado como `.kit` solo cuando la plantilla cambió.

## 3.2 Proyecto con código existente

1. Rellena `pipeline.config.json`. `/kit-init` mira tu código (`package.json`, `build.gradle.kts`, `pyproject.toml`…) y te propone los valores; confirma y los aplica.
2. Completa `AGENTS.md` con la descripción y convenciones del proyecto.
3. Verifica: `kit check`.
4. Lanza tu primera feature:

```
/pipeline "Quiero que los usuarios puedan restablecer su contraseña por correo"
```

Los agentes no reescriben tu código: el arquitecto explora solo los módulos que la feature toca (y a partir de la primera feature, `docs/ARQUITECTURA.md`), y el implementador modifica únicamente los archivos del plan del ADR, en una rama `feature/*` creada desde la rama base que le indiques al empezar (`develop`, `release_xx`…). Al final tienes un PR abierto contra esa base.

## 3.3 Proyecto vacío, solo con la idea

```powershell
mkdir mi-proyecto; cd mi-proyecto; git init -b main
copilot
```

```
/kit-init
/pipeline "Una app para registrar los gastos del hogar con categorías y resumen mensual"
```

No hace falta rellenar `pipeline.config.json`. El pipeline detecta que no hay código y: el product-owner escribe la spec y tú la apruebas; el arquitecto propone **dos variantes de stack dentro de React Native bare** (navegación, estado, red, persistencia) en `docs/adr/0000-stack.md` y **tú eliges**; el implementador hace el bootstrap con `npx @react-native-community/cli@latest init` y rellena `pipeline.config.json` y `AGENTS.md`; y sigue como en cualquier proyecto.

## 3.4 Comandos dentro de Copilot

En la **CLI** se invocan como skills (`/pipeline …`); en **VS Code** como prompts (`/pipeline` y rellenas la idea) o pidiéndoselo a `@director`. Ver [08-superficies-copilot.md](08-superficies-copilot.md).

| Comando | Qué hace |
|---|---|
| `/pipeline "idea"` | Flujo completo (ver [04-flujo-y-compuertas.md](04-flujo-y-compuertas.md)) |
| `/pipeline bmoshell-123 "idea"` | Con ticket de Jira: rama `feature/BMOSHELL-123-<desc>`, docs con ese slug y commits `feat: BMOSHELL-123 …` (lo exige el hook). Igual en `/bugfix` (`fix/…`) |
| `/pipeline continuar <slug>` | Retoma un pipeline interrumpido |
| `/pipeline continuar <epica>` · `/pipeline --epica "idea grande"` | Retoma la siguiente HU de una idea partida en varias (`docs/epicas/<nombre>.md`) · fuerza la partición en HU (ver [04 §4.7](04-flujo-y-compuertas.md)) |
| `/pipeline --rapido "idea"` | Cambio pequeño (tamaño S): sin ADR y sin revisor de código, con QA y seguridad; queda registrado como compuertas reducidas. El product-owner estima `TAMAÑO: S|M|L` en cada spec y el orquestador te propone el modo rápido si es S |
| `/pipeline --sdk <nombre> "idea"` | Feature que nace en un SDK del equipo y termina integrada en este proyecto ([12](12-sdks-y-end-to-end.md)) |
| `/analisis "alcance o pregunta"` | Análisis de solo lectura (arquitectura, calidad, seguridad) con hallazgos priorizados en `docs/analisis/` |
| `/bugfix "descripción o traza"` | Reproducir → prueba roja → corregir en `fix/*` → QA → revisiones → PR. `--solo-diagnostico` para solo investigar; `--urgente` para hotfix con compuertas reducidas y registradas |
| `/ideas ["dirección"]` | Ideas equilibradas (producto + mercado + técnicas) priorizadas. `--producto`, `--mercado` (benchmark web con el investigador) o `--tecnico` |
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
| Hotfix urgente | `/bugfix --urgente "…"` (te pedirá confirmar qué compuertas se omiten; el PR sale igual) |
| Que el equipo te proponga mejoras o nuevas funciones | `/ideas` (equilibrado), `/ideas --producto "para familias"`, `/ideas --tecnico` |
| Ver qué hacen productos parecidos y qué funciones adoptar | `/ideas --mercado "apps de hábitos para niños"` o `@investigador benchmark de …` |
| Una tarea puntual de un rol | `@arquitecto …`, `@revisor-seguridad …`, `@tester …` |
| Que Copilot lo haga en la nube a partir de un issue | Asignar el issue a Copilot en github.com (ver [09](09-cloud-agent-y-github.md)) |

`/analisis` e `/ideas` nunca tocan código: escriben en `docs/analisis/` y `docs/ideas/`. Los bugs corregidos dejan su causa raíz en `docs/RETRO.md`, que `/ideas` lee para proponer mejoras que ataquen causas recurrentes.

## 3.6 Comandos en la terminal (fuera de Copilot; iguales en Windows y macOS)

| Comando | Qué hace |
|---|---|
| `kit check` | Verifica Node ≥ 18, Git, Copilot CLI, `gh`, toolchain Android/iOS (aviso) y la configuración |
| `kit pr --feature <slug> --base <rama>` | Comprueba compuertas, sube la rama y abre el pull request con `gh` (lo ejecuta el release-manager; si `gh` falla, sube la rama y deja la descripción en `docs/reviews/<slug>-pr.md`) |
| `kit init` | Re-ejecutar la inicialización (sin sobrescribir lo tuyo) |
| `kit update` | Refrescar los archivos gestionados por el kit tras actualizar el plugin |
| `kit migrate` | Convertir un `pipeline.config.ps1` antiguo en `pipeline.config.json` |
| `kit version` | Versión del plugin y de los archivos del proyecto |
| `kit epica list\|status\|next\|add\|set` | Épicas: progreso real de cada HU (leído de specs, informes, ramas y estado), siguiente HU y comando para retomarla |
| `kit doctor [--fix]` | Diagnóstico del kit: plugin frente a GitHub, archivos y modo del proyecto, hooks (prueba real), permisos, copias `.kit`, locks de git; `--fix` aplica lo seguro |
| `kit update --limpiar` / `--plugin` | Borra las copias `.kit` ya revisadas / actualiza el propio plugin (Copilot) si GitHub tiene versión nueva |
| `kit state reset` | Cierra la feature actual (la archiva en `.pipeline/historial.jsonl`) y deja el estado limpio para la siguiente |
| `kit lecciones [add "…"]` | Lecciones reutilizables entre proyectos (`~/.multiagent-kit/lecciones.md`); las escribe `/retro-kit` y las leen los agentes |
| `kit sdk api <nombre>` · `sdk publish <nombre> --version X.Y.Z` | Breaking changes de la API pública del SDK frente a la rama base · versión definitiva del SDK y dependencia del padre (paso humano). Ver [12](12-sdks-y-end-to-end.md) |
| `kit sdk list\|sync\|pack\|status` | SDKs del equipo declarados en `SDKS`: sincronizar (ruta local o clon por rama), empaquetar versión de trabajo y enlazarla en el padre (ver [12](12-sdks-y-end-to-end.md)) |
| `kit status` | Estado del pipeline y compuertas; avisa de documentos demasiado largos |
| `kit state clave=valor` | Actualiza el estado (lo usan los agentes; nunca se edita el JSON a mano) |

## 3.7 Nada del kit en el repositorio

Este kit tiene un solo modo. En el proyecto quedan `pipeline.config.json`, `AGENTS.md` y `.pipeline/`, los tres en `.git/info/exclude`; agentes, skills, prompts y hooks viven en tu perfil (`~/.copilot/{agents,skills,hooks}` y `User/prompts` de VS Code) y valen para todos los repositorios del PC. **Lo único que se versiona es lo que producen los agentes**: `docs/specs`, `docs/adr`, `docs/reviews`, `docs/epicas` y `docs/ARQUITECTURA.md`, que forman parte de la entrega y el PR los enlaza. `--modo repo|local` no existe aquí (si lo pasas, se ignora con aviso).

Consecuencia: el cloud agent de github.com no puede usar el kit (necesita los agentes dentro del repo). Los agentes se usan desde Copilot CLI y VS Code en tu máquina.

**Proyecto con copias de una versión anterior** (`.github/agents`, `.github/skills`, `kit.js`, plantillas): `kit doctor` las detecta y `kit doctor --fix --usuario` las retira si siguen idénticas a lo que el kit copió; lo que editaste se conserva y se avisa. Las que estaban versionadas quedan como borradas en `git status`: revisa y haz commit.


---
Anterior: [02-publicar-en-github.md](02-publicar-en-github.md) · Siguiente: [04-flujo-y-compuertas.md](04-flujo-y-compuertas.md) · [Índice](../README.md)
