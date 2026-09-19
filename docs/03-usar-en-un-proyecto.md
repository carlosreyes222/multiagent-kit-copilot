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

Haz **commit de todo `.github/` y `kit.js`**: así el equipo y el cloud agent usan exactamente lo mismo. Si no puedes o no quieres versionar nada del kit, usa los modos `local` o `usuario` (§3.7).

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
| `/pipeline bmoshell-123 "idea"` | Con ticket de Jira: rama `feature/BMOSHELL-123-<desc>`, docs con ese slug y commits `feat: BMOSHELL-123 …` (lo exige el hook). Igual en `/bugfix` (`fix/…`) |
| `/pipeline continuar <slug>` | Retoma un pipeline interrumpido |
| `/pipeline --rapido "idea"` | Cambio pequeño (tamaño S): sin ADR y sin revisor de código, con QA y seguridad; queda registrado como compuertas reducidas. El product-owner estima `TAMAÑO: S|M|L` en cada spec y el orquestador te propone el modo rápido si es S |
| `/pipeline --sdk <nombre> "idea"` | Feature que nace en un SDK del equipo y termina integrada en este proyecto ([14](14-sdks-y-end-to-end.md)) |
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
| `node kit.js doctor [--fix]` | Diagnóstico del kit: plugin frente a GitHub, archivos y modo del proyecto, hooks (prueba real), permisos, copias `.kit`, locks de git; `--fix` aplica lo seguro |
| `node kit.js update --limpiar` / `--plugin` | Borra las copias `.kit` ya revisadas / actualiza el propio plugin (Copilot) si GitHub tiene versión nueva |
| `node kit.js state reset` | Cierra la feature actual (la archiva en `.pipeline/historial.jsonl`) y deja el estado limpio para la siguiente |
| `node kit.js lecciones [add "…"]` | Lecciones reutilizables entre proyectos (`~/.multiagent-kit/lecciones.md`); las escribe `/retro-kit` y las leen los agentes |
| `node kit.js sdk api <nombre>` · `sdk publish <nombre> --version X.Y.Z` | Breaking changes de la API pública del SDK frente a la rama base · versión definitiva del SDK y dependencia del padre (paso humano). Ver [14](14-sdks-y-end-to-end.md) |
| `node kit.js sdk list\|sync\|pack\|status` | SDKs del equipo declarados en `SDKS`: sincronizar (ruta local o clon por rama), empaquetar versión de trabajo y enlazarla en el padre (ver [14](14-sdks-y-end-to-end.md)) |
| `node kit.js status` | Estado del pipeline y compuertas; avisa de documentos demasiado largos |
| `node kit.js state clave=valor` | Actualiza el estado (lo usan los agentes; nunca se edita el JSON a mano) |

## 3.7 Modos de instalación: repo, local o usuario

`node kit.js init` acepta `--modo repo|local|usuario` (`/kit-init` te lo pregunta). Elige según de quién sea el repositorio:

| Modo | Qué queda en el proyecto | Qué ve git | Quién lo ve | Cuándo |
|---|---|---|---|---|
| `repo` (por defecto) | Todo: `.github/` (agentes, skills, prompts, hooks) + config | Todo, se commitea | Todo el equipo, VS Code, CLI y el **cloud agent** | Repositorio propio o del equipo que adopta el kit |
| `local` | Lo mismo que `repo` | **Nada**: cada archivo va a `.git/info/exclude` (privado de tu clon, no se sube nunca) | Solo tú, en este clon | Quieres probar el kit en un repo sin ensuciar `git status` |
| `usuario` | Solo `pipeline.config.json`, `kit.js`, `AGENTS.md`, `.pipeline/` y las plantillas de `docs/`, todos en `.git/info/exclude` | **Nada** | Solo tú, en **todos** tus repos: agentes, skills y hooks viven en `~/.copilot/{agents,skills,hooks}` y los prompts/agentes en el perfil de usuario de VS Code | Repositorios ajenos o del trabajo donde no puedes añadir archivos |

En modo `usuario` el kit se instala una vez por PC (la primera vez que lo ejecutas) y `node kit.js update` refresca tanto el perfil como el proyecto; el hook de usuario solo actúa en carpetas que tengan `pipeline.config.json`, así que no interfiere en otros repos. Limitaciones: el cloud agent de github.com no ve los agentes (necesita los archivos en el repo), y los prompts de VS Code se copian a la carpeta `User/prompts` de tu perfil (si VS Code está en otra ruta, define `KIT_VSCODE_PROMPTS_DIR`). `.github/copilot-instructions.md` y `copilot-setup-steps.yml` no se crean en este modo.

Cambiar de modo: `node kit.js init --modo usuario` retira de `.github/` lo que el kit copió en modo `repo` (si no lo editaste); `node kit.js init --modo repo` vuelve a copiar los archivos; borra a mano las líneas del bloque `multiagent-kit` en `.git/info/exclude` si quieres versionarlos.

---
Anterior: [02-publicar-en-github.md](02-publicar-en-github.md) · Siguiente: [04-flujo-y-compuertas.md](04-flujo-y-compuertas.md) · [Índice](../README.md)
