---
name: pipeline
description: Orquesta el flujo multiagente completo de una feature — ideación → spec → arquitectura → implementación → QA → revisión de código y seguridad → staging → documentación de arquitectura — con compuertas entre etapas. Funciona también en un proyecto vacío (propone stack y crea el esqueleto). Uso — /pipeline "descripción de la idea" · /pipeline --sdk <nombre> "idea" (feature que nace en un SDK del equipo y termina en este proyecto)
disable-model-invocation: true
---

Eres el orquestador del pipeline. NO haces el trabajo tú mismo: delegas cada etapa al agente delegado correspondiente y aplicas las compuertas. Idea del usuario: **la petición del usuario** (el texto que acompaña a la invocación de la skill)

## Cómo delegar (GitHub Copilot)
Cada etapa la hace un **agente personalizado del kit** (`product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`). Delega con la herramienta de subagentes (`task`/`agent` en la CLI de Copilot y en el cloud agent; `runSubagent` en VS Code) indicando el nombre del agente, la instrucción completa y las rutas de entrada. Espera su línea final de veredicto antes de seguir. Si en tu entorno no puedes lanzar subagentes, pide al usuario que ejecute la etapa con `@<agente>` (VS Code) o `copilot --agent <agente> -p "..."` (CLI) y pégate el resultado.

## Paso 0 — Preparación
1. **Ticket de Jira**: si el texto contiene un identificador tipo `abc-123` (p. ej. `/pipeline bmoshell-123 login biométrico`), es el ticket: pásalo a MAYÚSCULAS (`BMOSHELL-123`), quítalo del texto y úsalo en todo el flujo — slug = `<TICKET>-<descripcion-corta>` (ej. `BMOSHELL-123-login-biometrico`), rama `feature/<slug>`, spec/ADR/informes con ese slug, commits `feat: BMOSHELL-123 descripción` (o `test:`, `docs:`, `chore:`…), y en `--sdk` la misma rama en el SDK. Regístralo: `node kit.js state ticket=<TICKET>` (el hook bloqueará ramas y commits que no lo lleven). Sin ticket, slug y rama como siempre (`feature/<slug>`). 
1. Si los argumentos incluyen `--rapido`, aplica la sección "Modo rápido". Si incluyen `--sdk <nombre>`, aplica además la sección "Flujo end-to-end con un SDK" de abajo. Deriva un slug en kebab-case de la idea (máx. 4 palabras, ej. `login-biometrico`). Confírmalo al usuario en una línea y continúa.
2. Comprueba que estás en un repositorio git y que `pipeline.config.json` existe (si no, indica al usuario que ejecute `/kit-init` y detente).
3. **Detecta el modo**:
   - **PROYECTO NUEVO** si no hay código fuente aparte de los archivos del kit (solo `pipeline.config.json`, `AGENTS.md`, `kit.js`, `docs/`, `staging/`, `.github/`) o si `BUILD_CMD` y `TEST_CMD` están vacíos y no existe `docs/ARQUITECTURA.md`.
   - **PROYECTO EXISTENTE** en cualquier otro caso. Si `TEST_CMD` está vacío en un proyecto existente, avisa de que el tester no podrá ejecutar pruebas y pregunta si continuar.
4. Si `AGENTS.md` lista skills de stack, indícalo a cada agente al delegar ("aplica stack-android y stack-db").
5. Registra el inicio con el script (nunca editando el JSON a mano): `node kit.js state feature=<slug> type=feature mode=<nuevo|existente> stage=spec`.

## Etapa 1 — Ideación → Spec
Delega al agente **product-owner** con la idea y el slug. Espera `SPEC: docs/specs/<slug>.md`.
Muestra al usuario los criterios de aceptación, las preguntas abiertas y el `TAMAÑO` estimado (si es S, propón el modo rápido y espera su respuesta). **COMPUERTA HUMANA**: pregunta si aprueba la spec o quiere cambios. No continúes sin un sí explícito.

## Etapa 2 — Arquitectura
**Proyecto existente**: delega al **arquitecto** con la spec. Espera `ADR: docs/adr/<slug>.md`. Resume la decisión y los riesgos de seguridad en 5 líneas.

**Proyecto nuevo**: delega al **arquitecto** indicándole explícitamente `MODO: PROYECTO NUEVO`. Producirá `docs/adr/0000-stack.md` con dos opciones de stack y una recomendación. Preséntaselas al usuario con pros y contras. **COMPUERTA HUMANA**: el usuario elige el stack (o pide otra opción). Solo entonces vuelve a delegar al arquitecto para que marque la opción elegida como aceptada en `0000-stack.md`, cree la primera versión de `docs/ARQUITECTURA.md` y escriba el ADR de la feature (`docs/adr/<slug>.md`), cuyo plan de implementación DEBE empezar por el bootstrap del proyecto.

## Etapa 3 — Implementación
Delega al **implementador** con spec + ADR (y, en proyecto nuevo, indícale `MODO: PROYECTO NUEVO` para que haga primero el bootstrap: esqueleto, primera prueba que pasa, y rellenar `pipeline.config.json` y `AGENTS.md` con los comandos reales). Espera `IMPLEMENTADO: feature/<slug>`.
En proyecto nuevo, tras esta etapa lee `pipeline.config.json` y confirma que `BUILD_CMD` y `TEST_CMD` ya no están vacíos; si lo están, devuelve la tarea al implementador.

## Etapa 4 — QA
Delega al **tester**. Si responde `QA: RECHAZADO`, vuelve a la Etapa 3 pasando `docs/reviews/<slug>-qa.md` como correcciones. Máximo 2 iteraciones; si sigue fallando, detente y presenta el informe al usuario.

## Etapa 5 — Revisiones (en paralelo)
Lanza **al mismo tiempo** al **revisor-codigo** y al **revisor-seguridad** sobre la rama. Espera ambos veredictos.
- Si alguno es RECHAZADO: vuelve a la Etapa 3 con los informes correspondientes y, tras corregir, repite Etapas 4 y 5. Máximo 2 iteraciones.
- Si ambos APROBADOS: continúa.

## Etapa 6 — Staging
Delega al **release-manager**. Espera `STAGING: LISTO` o `STAGING: FALLÓ`.
Si falló por código, vuelve a la Etapa 3; si falló por infraestructura (Docker, puertos), reporta al usuario y detente.

## Etapa 7 — Documentación de arquitectura (obligatoria)
Delega al **arquitecto** indicándole `MODO: DOCUMENTAR` con el slug. Actualizará `docs/ARQUITECTURA.md` para reflejar el estado real tras la feature (módulos nuevos o cambiados, decisiones vigentes, deuda) y, si cambió alguna convención, `AGENTS.md`. Espera `ARQUITECTURA: ACTUALIZADA`. Esta etapa no se salta: es lo que permite que los siguientes pipelines no tengan que releer todo el proyecto.

## Etapa 8 — Entrega al humano
Presenta un resumen final con:
- Rama, spec, ADR, `docs/ARQUITECTURA.md` y los cuatro informes (`docs/reviews/<slug>-{qa,codigo,seguridad,release}.md`).
- URL de staging para que el usuario pruebe manualmente.
- El comando exacto para promover: `node kit.js prod`
**Nunca ejecutes `node kit.js prod` tú mismo.** La promoción a producción es siempre una acción humana.

## Modo rápido (`--rapido` o tamaño S)
Para cambios pequeños el pipeline completo es desproporcionado. Tamaño de la feature: lo estima el product-owner en la spec (línea `TAMAÑO: S|M|L`; S = un módulo, sin cambios de datos ni de API pública, < ~150 líneas). Se activa si los argumentos traen `--rapido` o si la spec dice `S` y **el usuario confirma** cuando se lo propones en la compuerta de la spec. Registra `node kit.js state tamano=<S|M|L> compuertas=reducidas`.
Con compuertas reducidas:
- **Etapa 2**: sin ADR. El arquitecto añade a la spec una sección "Nota técnica" (≤ 15 líneas: archivos a tocar, riesgos) — `MODO: NOTA TECNICA`.
- **Etapa 4**: QA con una sola iteración; si rechaza, pasa a pipeline completo (`compuertas=completas`).
- **Etapa 5**: solo el **revisor-seguridad** (el revisor-codigo se omite). Si la seguridad detecta cambios de API, datos o autenticación, escala a pipeline completo.
- Etapas 6, 7 y 8 iguales. En la entrega indica explícitamente "compuertas reducidas (S)" y qué se omitió.
Nunca uses el modo rápido con `--sdk`, con cambios de esquema de base de datos ni con nada que toque autenticación, pagos o secretos.

## Flujo end-to-end con un SDK del equipo (`--sdk <nombre>`)
Se activa cuando los argumentos contienen `--sdk <nombre>` y `pipeline.config.json` declara ese SDK en `SDKS` (si no está declarado, pide al usuario que lo añada y detente; `node kit.js sdk list` muestra los declarados). La feature nace en el SDK y termina integrada en este proyecto (el padre). Diferencias respecto al flujo normal:
- **Paso 0**: ejecuta `node kit.js sdk sync <nombre>` (clona o actualiza la rama declarada, `main` por defecto; con `--rama x` en los argumentos, pásaselo). Lee `.pipeline/sdks.json` para conocer la carpeta del SDK y pásala a todos los agentes. Registra `node kit.js state … sdk=<nombre>`.
- **Etapa 1 (spec)**: la spec vive en el padre (`docs/specs/<slug>.md`) y debe separar "cambios en el SDK" de "cambios en el padre" (qué API nueva expone el SDK y cómo la usa el padre).
- **Etapa 2 (arquitectura)**: el arquitecto lee el código del SDK en su carpeta y el del padre; el ADR tiene dos planes: SDK (archivos, API pública, pruebas) y padre (integración). Indícale `MODO: FEATURE` y la carpeta del SDK.
- **Etapa 3 (implementación)**, en dos partes y en este orden. Indícale al implementador `MODO: SDK` con nombre y carpeta:
  1. En el SDK: rama `feature/<slug>`, código + pruebas del SDK, commits **sin push** (los hooks aplican también ahí).
  2. `node kit.js sdk pack <nombre> --feature <slug>`: crea la versión de trabajo `X.Y.Z-local.N`, la publica en local (tgz en `vendor/sdks/`, Maven local o ruta) y actualiza la dependencia del padre.
  3. En el padre: rama `feature/<slug>`, integración usando la nueva API, commits.
  Espera `IMPLEMENTADO: feature/<slug> (SDK <nombre> <versión>)`.
- **Etapas 4 y 5**: el tester ejecuta las pruebas del SDK (comando `test` de su entrada en `SDKS`, o el del propio SDK) y las del padre (`TEST_CMD`); los revisores revisan ambos diffs (indícales las dos carpetas y las dos ramas).
- **Etapa 8 (entrega)**: además de lo habitual, lista rama y commits del SDK, la versión de trabajo enlazada, los archivos del padre que cambiaron por el enlace (`package.json`, `libs.versions.toml`, `Podfile`…), el resultado de `node kit.js sdk api <nombre>` (si hay BREAKING, la versión definitiva debe subir la major) y el comando que el usuario ejecutará cuando apruebe: `node kit.js sdk publish <nombre> --version X.Y.Z` (fija la versión definitiva en el SDK, la enlaza en el padre y le dice qué publicar y en qué orden). **Nunca lo ejecutes tú**: es un paso humano, como `prod`. **Nunca** publiques a un registro (npm publish, Maven remoto) ni hagas push del SDK.
Si el usuario solo dice "usa la versión nueva del SDK" sin feature en el SDK, basta con `node kit.js sdk sync` + `sdk pack` y el flujo normal en el padre.

## Reglas globales
- Cada vez que una compuerta rechaza, explica al usuario en 2 líneas qué falló y qué se va a reintentar.
- Si el usuario interrumpe con cambios de alcance, actualiza la spec (Etapa 1) antes de seguir.
- Al entrar en cada etapa ejecuta `node kit.js state stage=<etapa>` y, al recibir veredictos, `node kit.js state qa=APROBADO` / `codigo=…` / `seguridad=…` (claves permitidas en `node kit.js state` sin argumentos). Nunca edites `.pipeline/state.json` a mano. `/pipeline continuar <slug>` lee ese estado.
- Si `**la petición del usuario** (el texto que acompaña a la invocación de la skill)` empieza por `continuar`, lee el estado y retoma desde la etapa guardada.
- Al terminar una feature (entrega hecha) o antes de empezar otra distinta, `node kit.js state reset` archiva el estado en `.pipeline/historial.jsonl` y limpia veredictos, `sdk` y `tamano` para que no contaminen el siguiente pipeline.
