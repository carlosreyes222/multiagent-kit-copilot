# Changelog

## 2.3.0 — SDKs una vez por semana, rama validada y detección del proyecto
Después de actualizar el plugin: `kit update`.
- **SDKs: actualización semanal.** Al empezar un flujo el orquestador usa `kit sdk sync --auto`: clona el SDK si falta y, si ya está, solo va a la red cuando pasaron `SDK_SYNC_DIAS` días (7 por defecto, en `pipeline.config.json`) o cambió la `rama`. `kit sdk sync [nombre]` sigue actualizando siempre, y `SDK_SYNC_DIAS: 0` vuelve a actualizar en cada flujo.
- **SDKs: `rama` validada.** La rama de cada SDK (`main` por defecto) y `--rama` se validan como nombre de rama antes de llegar a git; un valor con espacios, `..` o caracteres de shell se rechaza (`kit check`/`kit doctor` lo avisan).
- **"Proyecto no inicializado" por error.** Los agentes comprueban la inicialización con `kit version` en la terminal en lugar de buscar archivos: `pipeline.config.json` y `.pipeline/` están excluidos de git y la búsqueda de VS Code no los muestra. El aviso de `session-start` dice desde qué carpeta buscó y pide esa comprobación antes de proponer reinicializar.
- **VS Code**: `session-start` devuelve también `hookSpecificOutput.additionalContext`, el formato que VS Code espera; antes el contexto del kit (versión, SDKs, avisos) no llegaba al chat de VS Code.

## 2.2.0 — solo la arquitectura en git; specs, ADR e informes se archivan en tu perfil
Después de actualizar: `copilot plugin update multiagent-kit@carlos-kits-copilot` y, en cada proyecto, `kit update` (añade las exclusiones) y `kit doctor`.
- **Documentos de trabajo fuera de git.** Solo `docs/ARQUITECTURA.md` (y `docs/detalle/`) se versiona. `docs/specs/`, `docs/adr/`, `docs/reviews/`, `docs/epicas/`, `docs/analisis/`, `docs/ideas/`, `docs/kit-feedback/` y `docs/RETRO.md` van a `.git/info/exclude` (`kit init`/`update`, o `kit doctor --fix`). Ya no ensucian el historial ni el diff del PR con documentos que solo sirven mientras dura la feature.
- **`kit pr`** ya no exige informes commiteados ni commitea la descripción del PR (no hace commits). Como el revisor del PR no ve los archivos, la descripción lleva un **resumen**: veredicto de cada compuerta con el commit revisado, criterios de aceptación de la spec, sección *Decisión* del ADR, observaciones de seguridad, commits y *Cómo probar* del informe de QA. Los cambios en documentos de trabajo no cuentan como "rama sucia" (tampoco en repos que aún los versionan, donde además avisa).
- **Archivo en el perfil.** `kit state reset` mueve spec, ADR, informes, descripción y estado del PR de la feature a `~/.multiagent-kit/archivo/<proyecto>/<slug>/` (con `archivo.json`: ticket, épica, URL del PR). Los que sigan versionados se copian, no se mueven. `--sin-archivar` lo evita. Nuevos: `kit archivo [slug]` (lista), `kit state restaurar <slug>` (el PR pidió cambios tras cerrar) y `kit state archivar <slug>` (features cerradas antes de esta versión).
- **Épicas**: una HU archivada cuenta como terminada; cuando todas terminan, la épica se archiva en `archivo/<proyecto>/_epicas/`.
- **`kit doctor`**: sección "Documentos de trabajo" — exclusiones que faltan (`--fix` las añade), documentos versionados (propone `git rm -r --cached …`; no lo hace solo) y features con PR entregado sin archivar.
- **Pipeline**: la documentación de arquitectura pasa a la Etapa 6, **antes** del PR, y el orquestador commitea `docs/ARQUITECTURA.md` en la rama: llega en el mismo PR (antes quedaba sin commitear después de abrirlo). El PR es la Etapa 7.
- Agentes y skills (`release-manager`, `metodo-pr`, `pipeline`, `bugfix`, instrucciones del kit, `retro-kit`) y guías 03, 04, 05 y 09 actualizados a la nueva política.
- Pruebas: 305 casos, la misma batería que el kit de Claude (scripts y pruebas idénticos en los dos repos; cada prueba sabe qué es propio de cada kit, p. ej. el ticket o `kit pr`), incluidos eventos en formato de Claude Code; `KIT_HOME` temporal y `KIT_NO_PATH` para que `npm test` nunca toque tu perfil ni tu PATH.

## 2.1.0 — hooks que no se saltan, PR ligado al código revisado y pruebas del kit
Después de actualizar: `copilot plugin update multiagent-kit@carlos-kits-copilot` y `kit update` (regenera el lanzador de hooks y el comando `kit`), y recarga VS Code.
- **Hooks reescritos con un parser de shell** (sh, cmd y PowerShell) en lugar de expresiones sobre el texto crudo. La versión 2.0.0 dejaba pasar 62 de los 90 comandos peligrosos de la nueva batería de pruebas. Ahora se bloquean:
  - opciones globales de git: `git -C dir push origin main`, `git -c k=v commit`, `git --no-pager push origin HEAD:main`;
  - envoltorios: `bash -c`, `sh -lc`, `pwsh -Command`, `-EncodedCommand`, `cmd /c`, `sudo`, `$(…)`, `(…)`, `{ … }`;
  - push de todas las ramas (`--all`, `--mirror`) y push forzado con `+rama` o `-uf`;
  - descartes de trabajo: `git clean -f`, `git checkout -- .`, `git restore .`, `git switch -f`, `git branch -D/-f` sobre una rama protegida;
  - borrados recursivos en las tres shells: `rm -fr`/`-r`, `Remove-Item -r`, `ri`, `rd /s`, `del /s`, `find -delete`, `xargs rm`, `rimraf`;
  - `gh pr merge` y el merge por `gh api`;
  - la lectura de secretos por terminal (`cat`, `type`, `Get-Content`, `cp`, `>`, `<`, `git add`, `git show HEAD:.env`, `curl -F @.env`…).
- **VS Code**: reconoce `run_in_terminal`, `read_file`, `create_file`, `replace_string_in_file`, `multi_replace_string_in_file`, `insert_edit_into_file` y `apply_patch`, y responde también con `hookSpecificOutput`. En Copilot CLI se evalúa además `write_bash`.
- **Secretos de iOS y firma**: `GoogleService-Info.plist`, `*.p8`, `*.mobileprovision`, `*.key`, `keystore.properties` y `~/.gradle/gradle.properties`, además de los que ya había.
- **Falla cerrado**: con `pipeline.config.json` ilegible, los agentes solo pueden diagnosticar (`kit doctor/check/status`, `git status/diff/log`); `session-start` lo avisa. Antes el hook fallaba abierto y desactivaba todas las protecciones.
- **Compuerta de commit**: se aplica también a `git -C dir commit`, `cd dir && git commit` y a los sub-repositorios del proyecto (`SUB_REPOS`, que antes se la saltaban).
- **`PROTECTED_BRANCHES` admite comodín** (`release_*`); la plantilla lo incluye.
- **Estado seguro con agentes en paralelo**: lock y escritura atómica en `.pipeline/state.json` (antes el revisor de código y el de seguridad podían perder un veredicto). Un JSON corrupto se aparta como `state.json.corrupto-<fecha>`. `kit state` valida los valores (veredictos, etapas, slug sin `..`, ticket, rama base). `kit status` muestra las compuertas del PR en lugar de `staging_ok/smoke_ok`.
- **`kit pr`**:
  - invoca git y gh sin shell, así que un título de spec con `$(…)` o `&` ya no puede ejecutarse;
  - exige un único veredicto por informe (dos distintos, p. ej. el `RECHAZADO` de la plantilla más un `APROBADO`, cuentan como no aprobado);
  - bloquea si el código cambió después del `COMMIT: <sha>` que declara cada informe (los informes sin esa línea solo generan un aviso);
  - hace `git fetch` de la base y la compara con `origin/<base>`: bloquea si la base no existe y avisa si la rama va por detrás o habrá conflictos;
  - solo reutiliza un PR **abierto**;
  - códigos de salida: 0 = creado, 2 = entrega parcial, 1 = bloqueado.
- **Agentes**: tester, revisor-codigo y revisor-seguridad escriben `COMMIT: <sha>` y un único veredicto; el revisor de código compara contra `pr_base` y no contra `main` fijo; release-manager y `metodo-pr` conocen los nuevos bloqueos y los códigos de salida. La plantilla de seguridad ya no menciona `prod.js`.
- **Lanzadores sin mezclar kits**: con los kits de Claude Code y de Copilot instalados, el comando `kit` y el lanzador de hooks elegían el plugin `multiagent-kit` más reciente de cualquiera de los dos. Ahora `scripts/launcher-src.js` los genera con la ruta del plugin que los instaló y eligen por sabor: los hooks de Copilot solo usan el plugin de Copilot, y `kit` usa el del proyecto (`AGENTS.md` o `CLAUDE.md`). Entre varias instalaciones gana la versión más alta, no la fecha.
- `session-start` ya no borra el `mode` de `.pipeline/kit.json`, y con eso desaparece el aviso "falta kit.js" en modo usuario.
- **Restos de la 2.0 retirados**: descripciones y palabras clave de `plugin.json` y `marketplace.json` (staging, Android, NestJS, Ktor), la tabla de staging/producción de `stack-react-native` y las ramas protegidas por defecto (ahora `main, master, develop, release`).
- **Pruebas del kit**: `npm test` (`node --test`, sin dependencias) con 287 casos (hooks en formato VS Code y CLI, compuerta de commit, estado concurrente, `kit pr` contra un origin local, lanzadores con los dos kits) y GitHub Actions en Windows, macOS y Linux. `KIT_TEST_PLUGIN=<ruta>` ejecuta la batería contra otra copia del plugin.
- Documentación: reparto VS Code (flujos) / terminal (`kit`), tabla de lo que bloquea el hook, problemas frecuentes nuevos, publicación con `npm test`, sincronización con el kit de Claude (lanzador compartido) y retirada de las referencias a `.github/` y al cloud agent.

## 2.0.0 — kit para el trabajo: React Native bare y entrega por pull request
- **Alcance**: solo React Native bare (`@react-native-community/cli`, TypeScript, sin Expo). Se retiran las skills `stack-android`, `stack-nestjs`, `stack-ktor` y `stack-db`; el arquitecto propone variantes dentro de RN bare y todos los agentes aplican `stack-react-native`.
- **El flujo termina en el PR**: nuevo `kit pr --feature <slug> --base <rama>` (comprueba compuertas aprobadas y commiteadas, escribe `docs/reviews/<slug>-pr.md`, `git push -u` y `gh pr create`; si `gh` falla deja la rama subida, y si el push falla, la rama local, siempre con el motivo). El release-manager y la skill `metodo-pr` sustituyen a staging/`metodo-deploy`. El orquestador pregunta la rama base al iniciar cada pipeline y bugfix (`pr_base` en el estado) y la rama `feature/*` se crea desde ella.
- **Retirado**: `kit staging`, `kit smoke`, `kit prod`, proveedores de staging (docker/compose/supabase/comando), `/deploy-staging`, `/promote-prod`, plantillas `staging/`, docs de Supabase y staging. La plantilla `pipeline.config.json` queda con comandos, sub-repos, SDKs, ramas protegidas (con `develop` y `release`) y límites.
- `kit check` comprueba `gh` (autenticado), Java/adb y Xcode en macOS (avisos, no bloqueos). `kit epica` considera una HU terminada con `PR: CREADO|RAMA SUBIDA` o rama fusionada.
- **Solo modo usuario**: `--modo repo|local` desaparece (se ignora con aviso); nada del kit se copia al repositorio, ni `.github/` ni `kit.js`. Se retiran las plantillas `copilot-instructions.md`, `copilot/settings.json`, `hooks/kit.json` y `copilot-setup-steps.yml`. El cloud agent de github.com queda fuera de alcance. Lo único versionado es lo que producen los agentes (`docs/`).
- Se mantienen: ticket de Jira en ramas y commits (exigido por el hook), SDKs del equipo, épicas, modo rápido, lecciones, doctor, modo usuario por defecto y comando global `kit`.

## 1.6.0 — nada del kit en los proyectos: comando global `kit`
- **Modo `usuario` por defecto**: `init` deja en el proyecto solo `pipeline.config.json`, `AGENTS.md` y `.pipeline/` (en `.git/info/exclude`). Las plantillas de documentos se leen del plugin (`kit plantilla <spec|adr|seguridad|arquitectura>`; una copia en `docs/` del proyecto tiene prioridad), `staging/` se crea solo al usar `kit staging` con `docker`.
- **Comando global `kit`** en `~/.multiagent-kit/bin` (se añade al PATH del usuario en Windows, macOS y Linux): `kit check`, `kit status`, `kit epica status`… desde cualquier proyecto, sin `kit.js`. `node kit.js` sigue funcionando en los modos `repo`/`local`.
- **Migración de proyectos existentes**: `kit doctor` detecta las copias del kit en modo `repo`/`local` y `kit doctor --fix --usuario` (o `kit init --modo usuario`) las retira si siguen idénticas a lo copiado, dejando los archivos versionados como borrados para que hagas commit.
- Agentes y skills actualizados a `kit …` y a la plantilla resuelta por `kit plantilla`. El hook bloquea `kit prod` y `kit sdk publish` igual que las variantes `node kit.js`.

## 1.5.0 — épicas
- **Épicas**: una idea grande se parte en HU (`docs/epicas/<nombre>.md`); el product-owner la propone (`MODO: EPICA`, o `/pipeline --epica`), tú la apruebas y el pipeline encadena las HU preguntando entre una y otra. `node kit.js epica list|status|next|add|set` recalcula el estado de cada HU desde disco (spec, ADR, rama, informes, merge, estado vivo) y dice cómo retomar; `/pipeline continuar <epica>` retoma la siguiente HU. `node kit.js status` muestra las épicas. Clave de estado nueva: `epica`.

## 1.4.0 — ticket de Jira, doctor, modo rápido, lecciones, SDK publish y breaking changes
- **Ticket de Jira en ramas y commits**: si la idea de `/pipeline` o `/bugfix` incluye `abc-123`, el ticket va en MAYÚSCULAS al slug (`BMOSHELL-123-login-biometrico`), a la rama (`feature/…`, `fix/…`, también en el SDK), a los documentos y al tag de producción; los commits siguen `<tipo>: BMOSHELL-123 descripción`. El hook bloquea ramas `feature/*`/`fix/*` y commits sin el ticket mientras esté registrado (`node kit.js state ticket=…`).
- **Aviso de versión nueva**: el hook de inicio de sesión y `node kit.js update` comparan la versión instalada con GitHub (una vez al día) y dicen cómo actualizar; `node kit.js update --plugin` ejecuta `copilot plugin update`.
- **`node kit.js doctor [--fix]`**: diagnóstico del kit — plugin, archivos y modo del proyecto, hooks (prueba real), permisos, `.kit`, locks de git, `SDKS` — con arreglo por problema; `--fix` aplica los seguros.
- **`update --limpiar`** borra las copias `.kit` revisadas; **`state reset`** cierra la feature (archiva en `.pipeline/historial.jsonl`) y limpia el estado; claves nuevas `tamano` y `compuertas`.
- **Modo rápido**: el product-owner estima `TAMAÑO: S|M|L`; con `--rapido` o S confirmado por el usuario, el pipeline omite el ADR (nota técnica en la spec) y el revisor de código, mantiene QA y seguridad, y registra `compuertas=reducidas`.
- **Lecciones entre proyectos**: `~/.multiagent-kit/lecciones.md`, que `/retro-kit` alimenta (`node kit.js lecciones add "…"`) y que arquitecto, implementador, tester y release-manager leen al empezar.
- **`sdk api <nombre>`**: instantánea de la API pública en `sdk sync` (`.d.ts`, `api/*.api` de BCV o fuentes) y comparación: símbolos eliminados sin subir la major = BREAKING (error; el revisor de código lo trata como BLOQUEANTE; `sdk pack` avisa).
- **`sdk publish <nombre> --version X.Y.Z`**: paso humano que fija la versión definitiva en el SDK (+ commit), cambia la dependencia del padre a la publicada, borra el tgz local y lista lo que queda por hacer. Bloqueado para los agentes por el hook.
- Prompt `/pipeline` acepta `--rapido`; el director confirma el modo rápido como compuerta humana.

## 1.3.2
- `init --modo usuario` en un proyecto que ya estaba en modo `repo`/`local` retira de `.github/` (y `.gitignore`/`.dockerignore`) lo que el kit había copiado, siempre que siga idéntico a lo copiado; lo que editaste se conserva y se avisa. Así cambiar de modo no deja archivos del kit en el repositorio.

## 1.3.1
- `update`/`init`: los hashes de archivos gestionados ignoran CRLF/LF, así que git en Windows (`autocrlf`) ya no hace que `kit.js` aparezca como "modificado por ti" y se quede sin actualizar.
- Los archivos tuyos (`pipeline.config.json`, `CLAUDE.md`/`AGENTS.md`, plantillas de `docs/`, `staging/`) solo generan una copia `.kit` cuando la plantilla del kit cambió desde tu último `update` (antes se regeneraban en cada ejecución). Borra los `.kit` antiguos que ya revisaste.

## 1.3.0 — SDKs del equipo y flujo end-to-end
- Nueva sección `SDKS` en `pipeline.config.json`: librerías propias que el proyecto consume (`npm`, `android`, `ios` o `comando`), por ruta local y/o repo git con rama (`main` por defecto; el clon va a `.pipeline/sdks/<nombre>`, fuera de git).
- `node kit.js sdk list|sync|pack|status`: sincroniza el SDK, genera una versión de trabajo `X.Y.Z-local.N` sin tocar el repo del SDK ni registros remotos, la publica en local (npm: tgz versionado en `vendor/sdks/` + `file:` en `package.json` + install; Android: `publishToMavenLocal` + versión en `libs.versions.toml`/gradle + `mavenLocal()`; iOS: `:path` en Podfile o `.package(path:)`) y actualiza la dependencia del padre.
- `/pipeline --sdk <nombre> "idea"`: la feature nace en el SDK (rama `feature/*`, commits sin push), se empaqueta y se integra en el padre en el mismo pipeline; spec y ADR separan SDK y padre; tester y revisores cubren ambos repos; la entrega recuerda los pasos humanos (PR del SDK, versión real, sustituir `-local.N`).
- Sin `--sdk`, los SDKs declarados son contexto de solo lectura para el arquitecto.
- Hooks: `protect-main` y `commit-gate` reconocen `git -C <dir>` y `cd <dir> && git …`, así que vigilan también el repo del SDK (compuerta con `test`/`lint` de la entrada del SDK). `check` valida `SDKS`; `session-start` los anuncia; estado con claves `sdk` y `sdk_version`.
- Prompt `/pipeline` de VS Code acepta `--sdk <nombre> idea`; el agente `director` sincroniza los SDKs al empezar.
## 1.2.0 — modos de instalación
- `node kit.js init --modo repo|local|usuario` (`/kit-init` lo pregunta). `local`: los archivos del kit van a `.git/info/exclude` (nada en git, solo este clon). `usuario`: nada del kit en el repositorio; agentes, skills, hooks y prompts se instalan en `~/.copilot/{agents,skills,hooks}` y en la carpeta de prompts de usuario de VS Code, válidos para todos los proyectos; en el proyecto solo quedan config, `kit.js`, `AGENTS.md`, `.pipeline/` y plantillas, excluidos de git. Hook de usuario con lanzador `~/.copilot/multiagent-kit-hook.js` que no interfiere en repos sin kit. `update` recuerda el modo y refresca el perfil. `check` verifica el perfil y el exclude.
- Agentes, prompts y director aceptan las skills desde `.github/skills/`, `~/.copilot/skills/` o el plugin.

## 1.1.1
- `kit.js`: corrige la búsqueda del plugin instalado (Claude Code lo guarda en `~/.claude/plugins/cache/<marketplace>/multiagent-kit/<versión>/`); ahora reconoce el plugin por el `name` de su manifiesto, no por el nombre de la carpeta. En proyectos ya migrados: `node kit.js update` (o copiar el `kit.js` nuevo).

## 1.1.0 — scripts en Node.js, sin PowerShell
- **Todos los scripts del kit reescritos en Node.js** (`scripts/*.js`, `kit.js` en el proyecto). Un solo código para Windows, macOS y Linux y el sandbox del cloud agent; no hace falta PowerShell 7 ni permisos de ejecución: solo Node ≥ 18, que ya exige la propia herramienta. Comandos idénticos en todos los sistemas: `node kit.js check|staging|smoke|prod|status|state|init|update|migrate|version`.
- **`pipeline.config.json`** sustituye a `pipeline.config.ps1` (mismas claves). `node kit.js migrate` (o `init`) convierte el archivo antiguo y lo deja como `.migrado`; mientras exista solo el `.ps1`, los scripts lo leen y avisan.
- **Hooks** unificados en `scripts/hook.js` (`protect-main`, `commit-gate`, `session-start`): entienden el evento de Claude Code / VS Code (PascalCase) y el de Copilot (camelCase); `.github/hooks/kit.json` los lanza con `node kit.js hook …` en `command`, `bash` y `powershell` (el mismo comando para VS Code, CLI y cloud agent).
- **`kit.js`** localiza el plugin en `~/.claude/plugins` o `~/.copilot/installed-plugins`, `.pipeline/kit.json` o `KIT_PLUGIN_ROOT`; `kit.js` es ahora un archivo gestionado (se refresca con `node kit.js update`).
- Los agentes ya no necesitan distinguir Windows/macOS para los comandos del kit; la sección "Sistema operativo" queda para `gradlew`, `winget`/`brew` y rutas.
- `check` muestra el sistema y da pistas de instalación por sistema (winget / brew / apt). Documentación actualizada (instalación Windows y macOS, sin PowerShell).
- **Migración de un proyecto existente**: actualizar el plugin, ejecutar en el proyecto `node "<plugin>/scripts/cli.js" init` (crea `kit.js`, convierte la config) y borrar `kit.ps1` y `pipeline.config.ps1.migrado` cuando estés conforme. En proyectos ya inicializados con la 1.0.x: `node "<plugin>/scripts/cli.js" init` y luego `node kit.js update`.

## 1.0.2
- **Windows y macOS/Linux**: los agentes detectan el sistema operativo antes de ejecutar comandos (sección "Sistema operativo" en `AGENTS.md`, en los agentes implementador/tester/release-manager y en `.github/instructions/kit.instructions.md`) y usan la forma correcta (`node kit.js` / `kit.js`, `.\gradlew` / `./gradlew`, `winget` / `brew`). Los scripts usan `cmd` o `sh` según el sistema y rutas con `/`. `node kit.js check` da pistas de instalación por sistema y muestra el SO detectado. Guía 01 con sección macOS.

## 1.0.1
- `stack-react-native`: React Native **bare con CLI, sin Expo** reforzado: comando de creación (`npx @react-native-community/cli@latest init`), detección de proyectos Expo (se avisa, no se convierte), prohibición explícita de `expo install`/`expo-router`/EAS, React Navigation en vez de `expo-router`, punto de revisión que rechaza dependencias `expo-*` sin ADR, tabla de comandos para `pipeline.config.json` (Gradle, Jest, tsc, staging `comando` con APK/Maestro) y `expo/skills` retirada de las complementarias. En los proyectos ya inicializados: `node kit.js update`.

## 1.0.0
Primera versión del kit multiagente para GitHub Copilot, equivalente a `multiagent-kit` 1.6.0 de Claude Code.

- **Plugin** en formato Agent Plugins 1.0 (`plugins/multiagent-kit/plugin.json`) con marketplace `carlos-kits-copilot` en `marketplace.json` (raíz del repositorio). Instalación: `copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot` + `copilot plugin install multiagent-kit@carlos-kits-copilot`.
- **Agentes** (`com.github.copilot/agents/*.agent.md`): `director` (orquestador, nuevo), `product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`. Herramientas con alias de Copilot; sin memoria ni worktree por agente; skill de método leída al empezar.
- **Skills**: `pipeline`, `analisis`, `bugfix`, `ideas`, `retro-kit`, `deploy-staging`, `promote-prod`, `kit-init`, `metodo-{spec,adr,code-review,qa,deploy}`, `stack-{android,react-native,nestjs,ktor,db}`. Bloque "Cómo delegar (GitHub Copilot)" en las skills orquestadoras.
- **Proyecto** (`node kit.js init`): `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/kit.instructions.md`, `.github/copilot/settings.json` (auto-instala el plugin en CLI y cloud agent), `.github/workflows/copilot-setup-steps.yml`, prompts de VS Code (`.github/prompts/*.prompt.md`), copias gestionadas de agentes, skills y hooks con manifiesto de hashes (`.github/kit-manifest.json`) y comando `node kit.js update`.
- **Hooks** (`.github/hooks/kit.json` → `node kit.js hook …`): `session-start` (contexto + aviso de versión), `protect-main` (ramas protegidas, merge sin `VEREDICTO: APROBADO`, producción, comandos destructivos, `.env*`/keystores), `commit-gate` (lint + tests). Aceptan payload camelCase (CLI/cloud) y PascalCase (VS Code); denegación por JSON `permissionDecision` + exit 2. Requieren PowerShell 7 en Windows.
- **Scripts** de staging (`docker`, `compose`, `supabase`, `comando`, `ninguno`), smoke, promoción a producción con compuertas y estado v2, ahora multiplataforma (Windows y Linux) para el cloud agent.
- **Documentación**: 13 guías (instalación, publicar, usar, flujo, arquitectura viva, actualizar, problemas, superficies de Copilot, cloud agent y GitHub, Supabase, staging por proveedor, skills externas, diferencias con el kit de Claude).
