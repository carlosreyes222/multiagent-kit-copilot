# 4. El flujo, los agentes y las compuertas

## 4.1 El flujo de `/pipeline`

```
 idea ──► product-owner ──► arquitecto ──► implementador ──► tester
                │  (spec)       (ADR)   (feature/TICKET-… desde   │
                │                          la rama base)    ▲     │ QA
          COMPUERTA HUMANA                                  │     ▼
          (apruebas la spec,                                │   ┌─── revisor-codigo ───┐
           dices la rama base)                              └───┤                      ├──► release-manager ──► PULL REQUEST
                                                      correcciones   revisor-seguridad ─┘   (kit pr: push + gh)      │
                                                                     (VEREDICTO: APROBADO)                          ▼
                                                  antes del PR: arquitecto (MODO: DOCUMENTAR) actualiza   EL EQUIPO: revisión del PR,
                                                  docs/ARQUITECTURA.md y se commitea en la rama           merge, tren de release
```

| Etapa | Agente | Produce | Compuerta |
|---|---|---|---|
| 1 Ideación | `product-owner` | `docs/specs/<slug>.md` | **Humana**: apruebas la spec |
| 2 Arquitectura | `arquitecto` | `docs/adr/<slug>.md` (y `0000-stack.md` en proyecto vacío) | **Humana** en proyecto vacío: eliges el stack |
| 3 Implementación | `implementador` | rama `feature/TICKET-<slug>` desde la rama base (ver §4.5) | Hook `commit-gate`: lint + tests en cada commit |
| 4 QA | `tester` | `docs/reviews/<slug>-qa.md` | `QA: APROBADO` o vuelve a 3 (máx. 2 veces) |
| 5 Revisiones (paralelo) | `revisor-codigo`, `revisor-seguridad` | `<slug>-codigo.md`, `<slug>-seguridad.md` | Ambos APROBADOS o vuelve a 3 |
| 6 Documentación | `arquitecto` | `docs/ARQUITECTURA.md` actualizado y commiteado en la rama | Obligatoria |
| 7 Pull request | `release-manager` | `<slug>-pr.md`, rama subida, PR abierto (`kit pr`) | Compuertas aprobadas sobre el código actual; sin `gh` o sin permisos: rama subida o local con el motivo |
| 8 Entrega | `director` (orquestador) | resumen + estado del PR; `kit state reset` archiva los documentos al cerrar | **Equipo**: revisión, merge y release fuera del kit |

Solo `docs/ARQUITECTURA.md` entra en git. Spec, ADR e informes (`docs/specs`, `docs/adr`, `docs/reviews`, `docs/epicas`) son documentos de trabajo: fuera de git mientras dura la feature y archivados en `~/.multiagent-kit/archivo/<proyecto>/<slug>/` al cerrarla (ver [03 §3.1](03-usar-en-un-proyecto.md)).

## 4.1b Los otros tres flujos

`/pipeline` es el flujo largo para features. Hay tres flujos más que reutilizan los mismos agentes:

- **`/analisis`** — arquitecto, revisor de código y revisor de seguridad leen en paralelo el alcance indicado y el coordinador consolida `docs/analisis/<fecha>-<slug>.md` con respuesta directa, hallazgos P1/P2/P3 y el comando del kit para cada acción. Sin compuertas humanas porque no cambia nada.
- **`/bugfix`** — tester (reproducir + prueba roja, compuerta: si no reproduce, se detiene) → implementador (corrección mínima en `fix/*`) → tester (regresión) → revisores en paralelo → release-manager (pull request con smoke del escenario del bug) → entrada en `docs/RETRO.md` con la causa raíz. `--urgente` reduce compuertas solo con confirmación explícita y lo deja registrado.
- **`/ideas`** — product-owner, investigador (benchmark web de productos similares), arquitecto y ambos revisores proponen ideas con evidencia; la consolidación garantiza al menos la mitad de producto/mercado; el coordinador consolida una tabla priorizada (impacto/esfuerzo/dependencias), tres recomendaciones y el comando para lanzar cada idea.

## 4.2 Los agentes

| Agente | Rol | Puede editar código |
|---|---|---|
| `director` | Orquestador: recibe el comando, lee la skill correspondiente y delega cada etapa; aplica las compuertas | no |
| `product-owner` | Idea → spec con criterios de aceptación verificables | no |
| `arquitecto` | Spec → ADR; propone stack en proyectos vacíos; mantiene `ARQUITECTURA.md` | no |
| `implementador` | Implementa en una rama `feature/*`; hace el bootstrap en proyectos vacíos | sí |
| `tester` | Escribe y corre pruebas por cada criterio de aceptación, reporta bugs | solo pruebas |
| `revisor-codigo` | Calidad, corrección, mantenibilidad (solo lectura) | no |
| `revisor-seguridad` | Secretos, inyección, autenticación, dependencias, OWASP (solo lectura) | no |
| `release-manager` | Comprueba compuertas, sube la rama y abre el PR (`kit pr`); nunca fusiona ni despliega | no |
| `investigador` | Benchmark externo (web, repos, tiendas, reseñas) de productos similares; propone funcionalidades adaptadas con fuente | no |

Cada agente lee al empezar su skill de método (`metodo-spec`, `metodo-adr`, `metodo-code-review`, `metodo-qa`, `metodo-pr`), que fija procedimiento, severidades y formato de los informes; y la skill `stack-react-native`. Los agentes viven en el plugin (`plugins/multiagent-kit/com.github.copilot/agents/`) y `kit init` / `kit update` los instalan en tu perfil (`~/.copilot/agents/` y la carpeta `User/prompts` de VS Code), no en el proyecto. No fijan modelo: heredan el de la sesión (puedes añadir `model:` en el frontmatter, p. ej. `claude-sonnet-4.6` o `gpt-5.4`, y publicar una versión nueva). Ver [08-superficies-copilot.md](08-superficies-copilot.md) para cómo se delegan en cada superficie.

## 4.3 Las compuertas, en detalle

1. **Humana, tras la spec.** Nada se construye sin que apruebes qué se va a construir.
2. **Humana, al elegir stack** (solo proyecto vacío). Es la decisión más cara de deshacer.
3. **Commit.** El hook `commit-gate` (`~/.copilot/hooks/multiagent-kit.json` → lanzador → `scripts/hook.js commit-gate`) ejecuta `LINT_CMD` y `TEST_CMD` antes de cada `git commit` del agente, también si lo lanza como `git -C <carpeta> commit`, `cd <carpeta> && git commit` o dentro de `pwsh -Command "…"`. Los commits en un sub-repositorio del proyecto (`SUB_REPOS`) pasan por los comandos del padre; los de un SDK declarado, por su `lint`/`test`. Si fallan, el commit se bloquea y el agente recibe las últimas líneas del error. Se desactiva con `GATE_TESTS_ON_COMMIT = false` en `pipeline.config.json`.
4. **Ramas protegidas, destructivos y secretos.** El hook `protect-main` analiza cada comando con un parser de shell que entiende sh, cmd y PowerShell (el terminal de VS Code en Windows), así que evalúa igual `git push origin main`, `git -C . push origin main`, `bash -c "…"`, `pwsh -Command "…"`, `cmd /c "…"` o `$(…)`. Ver la tabla de abajo.
5. **Revisiones.** QA, código y seguridad deben estar APROBADOS, con **un solo veredicto** por informe (los informes no se commitean). Cada informe declara `COMMIT: <sha>` del código que revisó; si después de ese commit cambió algo fuera de `docs/`, `kit pr` bloquea y hay que repetir esa revisión.
6. **Pull request.** `kit pr` sube la rama y abre el PR contra la rama base acordada; nunca fusiona. El merge, el tren de release y el despliegue son del equipo, con las reglas del repositorio en GitHub como barrera final.

**Qué bloquea `protect-main`** (a los agentes; tú, desde tu terminal, no pasas por el hook):

| Grupo | Ejemplos bloqueados | Permitido |
|---|---|---|
| Ramas protegidas (`PROTECTED_BRANCHES`, admite `release_*`) | `git commit` estando en una; `git push` a una (`origin main`, `HEAD:main`, `:develop`, `--delete`, `--all`, `--mirror`); `git branch -D/-f` sobre una; `git merge` a una sin `VEREDICTO: APROBADO` | `git push -u origin feature/…`, `git push` desde la feature |
| Forzados y descartes | `git push --force/-f/--force-with-lease/+rama`, `git reset --hard`, `git clean -f…`, `git checkout -- .`, `git restore .`, `git switch -f` | `git checkout -- src/archivo.ts`, `git restore --staged .`, `git clean -n` |
| Borrados recursivos | `rm -rf/-fr/-r`, `Remove-Item -Recurse` (y `ri`/`rm`/`del -r`), `rd /s`, `del /s`, `find -delete`, `xargs rm -rf`, `rimraf`, `[System.IO.Directory]::Delete` | `rm archivo`, `Remove-Item archivo -Force` |
| Merge fuera del kit | `gh pr merge`, merge por `gh api`, `gh repo delete/archive/rename` | `gh pr create`, `gh pr view` |
| Secretos y firma | leer, copiar, escribir o versionar `.env*` (salvo `.env.example/.sample/.template`), `*.jks`, `*.keystore`, `*.p12`, `*.p8`, `*.pem`, `*.key`, `*.mobileprovision`, `google-services.json`, `GoogleService-Info.plist`, `keystore.properties`, `~/.gradle/gradle.properties` — con las herramientas de leer/editar de VS Code y la CLI y también por terminal (`cat`, `type`, `Get-Content`, `cp`, `>`, `<`, `git add`, `git show HEAD:.env`, `curl -F file=@.env`…) | `echo ".env" >> .gitignore`, `cat .env.example` |
| Pasos humanos | `kit sdk publish` | — |
| Nomenclatura (con ticket registrado) | rama `feature/*`/`fix/*` sin el ticket; commit que no empieza por `<tipo>: <TICKET>` (lee también `-F archivo` y heredocs) | `git commit --amend --no-edit` |

Si `pipeline.config.json` no es JSON válido, el hook **falla cerrado**: los agentes no ejecutan comandos (salvo `kit doctor/check/status` y `git status/diff/log`) hasta que lo corrijas, y el aviso aparece al abrir la sesión. Es una defensa en profundidad, no la barrera final: un script que el agente escriba y ejecute no pasa por el hook. La barrera final son las reglas del repositorio en GitHub (ver [09](09-cloud-agent-y-github.md)).

Los hooks solo actúan en proyectos que tienen `pipeline.config.json`; en tus otros proyectos no interfieren.

El estado del pipeline (`.pipeline/state.json`, esquema v2) lo escriben solo los scripts: los agentes usan `kit state clave=valor` y tú lo consultas con `kit status`. Cada escritura toma un lock y reemplaza el archivo de forma atómica, así que el revisor de código y el de seguridad pueden registrar su veredicto a la vez sin pisarse. `kit state` rechaza claves y valores fuera del esquema (`qa=APROBAD`, `feature=../x`…). Si el archivo se corrompe, se guarda como `state.json.corrupto-<fecha>` y el estado sigue limpio.

## 4.4 La rama base y el pull request

Al iniciar cada `/pipeline` o `/bugfix` el orquestador te pregunta contra qué rama irá el PR (`develop`, `release_xx`, `main`…) y la guarda en el estado (`pr_base`). La rama `feature/*` se crea desde esa base actualizada. Al cerrar, `kit pr --feature <slug> --base <rama>`:

1. Actualiza `origin/<base>` y compara contra ella: si la base no existe (ni en origin ni en local) bloquea sin hacer push; si la rama va por detrás o habrá conflictos, avisa.
2. Comprueba que QA, código (salvo modo rápido) y seguridad están aprobados con un solo veredicto y que el código no cambió después del `COMMIT:` de cada informe; y que la rama no tiene código sin commitear (los documentos de trabajo no cuentan).
3. Escribe `docs/reviews/<slug>-pr.md` (local, fuera de git): título `<tipo>: TICKET …`, compuertas con su commit revisado, criterios de aceptación de la spec, decisión del ADR, observaciones de seguridad, commits propios frente a la base y cómo probar (sección *Cómo probar* del informe de QA). No hace commits.
4. Hace `git push -u origin <rama>` y abre el PR con `gh pr create`; si ya hay un PR **abierto** para la rama, lo reutiliza (uno cerrado o fusionado no cuenta).

Resultado en la última línea y en el código de salida: `PR: CREADO <url>` (0); `PR: RAMA SUBIDA (motivo)` si `gh` no está o falló (2: abres el PR con la descripción); `PR: RAMA LOCAL (motivo)` si el push no fue posible (2: sin remoto, permisos, rama remota con commits nuevos); `PR BLOQUEADO` con la lista de motivos (1). `git` y `gh` se invocan sin shell: un título de spec con `$(…)`, comillas invertidas o `&` nunca se ejecuta. Nunca `--force`, nunca cambio de base, nunca merge.

## 4.5 Nomenclatura de ramas y commits

| Situación | Rama | Commits | Base del PR |
|---|---|---|---|
| Feature sin ticket | `feature/<slug>` (ej. `feature/login-biometrico`) | libres, pequeños y descriptivos | la acordada al iniciar (`develop`, `release_xx`…) |
| Feature con ticket de Jira | `feature/<TICKET>-<slug>` (ej. `feature/BMOSHELL-123-login-biometrico`) | `<tipo>: <TICKET> descripción` (ej. `feat: BMOSHELL-123 añade refreshToken`) | la acordada |
| Bugfix | `fix/<slug>` o `fix/<TICKET>-<slug>` | `fix: <TICKET> descripción` | igual |
| Feature en un SDK (`--sdk`) | la misma rama en el SDK y en el padre | igual en los dos repos | igual |

El ticket se detecta solo: basta escribirlo en la idea (`/pipeline bmoshell-123 login biométrico`), en cualquier posición y en minúsculas; el orquestador lo pasa a MAYÚSCULAS, lo quita del texto y lo registra con `kit state ticket=BMOSHELL-123`. A partir de ahí el hook `protect-main` **bloquea** a los agentes cualquier rama `feature/*` o `fix/*` sin el ticket y cualquier `git commit -m` que no empiece por `<tipo>: <TICKET>` (tipos: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `style`, `revert`; también con scope, `feat(auth): …`). `kit state reset` al cerrar la feature lo limpia. Los documentos (`docs/specs`, `docs/adr`, `docs/reviews`) usan el mismo slug con ticket, así que todo lo de una feature se encuentra buscando `BMOSHELL-123`.

## 4.6 Tamaño de la feature y modo rápido

Cada spec termina con `TAMAÑO: S|M|L`. Si es S (un módulo, sin cambios de datos, API pública, autenticación ni pagos, < ~150 líneas) el orquestador te propone el **modo rápido** en la compuerta de la spec (o lo pides tú con `/pipeline --rapido "idea"`): sin ADR (el arquitecto deja una nota técnica de ≤ 15 líneas en la spec) y sin revisor de código; QA, revisor de seguridad, PR y arquitectura viva se mantienen. Queda registrado como `compuertas=reducidas` en el estado y en la entrega; si QA rechaza o seguridad detecta cambios de API, datos o autenticación, se escala al pipeline completo. No se combina con `--sdk`.

## 4.7 Épicas: una idea partida en varias HU

Cuando la idea no cabe en una feature (spec > 120 líneas, más de un par de días), el product-owner no escribe una spec: propone una **épica** con 3–10 historias de usuario independientes, en orden de dependencia, y la registra en `docs/epicas/<nombre>.md` (tabla `# · HU · Slug · Ticket · Estado · Depende de · Notas`). Tú apruebas la partición (compuerta humana) y el pipeline arranca con la primera HU; al terminar cada una te pregunta si sigues con la siguiente. También puedes forzarlo: `/pipeline --epica "idea grande"`.

El archivo lo mantiene el kit, no los agentes: `kit epica status <nombre>` recalcula el estado de cada HU **desde lo que hay en disco** (spec, ADR, rama `feature/*`, informes de QA/código/seguridad/release, si la rama está fusionada en main y el estado vivo del pipeline) y te dice la siguiente HU y el comando exacto para retomarla. `kit status` lo muestra también. Para retomar tras días: `/pipeline continuar <nombre-de-epica>`. Estados que solo se fijan a mano: `bloqueada` y `descartada` (`kit epica set <nombre> <slug> estado=bloqueada notas="…"`).

---
Anterior: [03-usar-en-un-proyecto.md](03-usar-en-un-proyecto.md) · Siguiente: [05-arquitectura-viva.md](05-arquitectura-viva.md) · [Índice](../README.md)
