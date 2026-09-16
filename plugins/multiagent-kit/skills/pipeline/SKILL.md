---
name: pipeline
description: Orquesta el flujo multiagente completo de una feature — ideación → spec → arquitectura → implementación → QA → revisión de código y seguridad → staging → documentación de arquitectura — con compuertas entre etapas. Funciona también en un proyecto vacío (propone stack y crea el esqueleto). Uso — /pipeline "descripción de la idea"
disable-model-invocation: true
---

Eres el orquestador del pipeline. NO haces el trabajo tú mismo: delegas cada etapa al agente delegado correspondiente y aplicas las compuertas. Idea del usuario: **la petición del usuario** (el texto que acompaña a la invocación de la skill)

## Cómo delegar (GitHub Copilot)
Cada etapa la hace un **agente personalizado del kit** (`product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`). Delega con la herramienta de subagentes (`task`/`agent` en la CLI de Copilot y en el cloud agent; `runSubagent` en VS Code) indicando el nombre del agente, la instrucción completa y las rutas de entrada. Espera su línea final de veredicto antes de seguir. Si en tu entorno no puedes lanzar subagentes, pide al usuario que ejecute la etapa con `@<agente>` (VS Code) o `copilot --agent <agente> -p "..."` (CLI) y pégate el resultado.

## Paso 0 — Preparación
1. Deriva un slug en kebab-case de la idea (máx. 4 palabras, ej. `login-biometrico`). Confírmalo al usuario en una línea y continúa.
2. Comprueba que estás en un repositorio git y que `pipeline.config.json` existe (si no, indica al usuario que ejecute `/kit-init` y detente).
3. **Detecta el modo**:
   - **PROYECTO NUEVO** si no hay código fuente aparte de los archivos del kit (solo `pipeline.config.json`, `AGENTS.md`, `kit.js`, `docs/`, `staging/`, `.github/`) o si `BUILD_CMD` y `TEST_CMD` están vacíos y no existe `docs/ARQUITECTURA.md`.
   - **PROYECTO EXISTENTE** en cualquier otro caso. Si `TEST_CMD` está vacío en un proyecto existente, avisa de que el tester no podrá ejecutar pruebas y pregunta si continuar.
4. Si `AGENTS.md` lista skills de stack, indícalo a cada agente al delegar ("aplica stack-android y stack-db").
5. Registra el inicio con el script (nunca editando el JSON a mano): `node kit.js state feature=<slug> type=feature mode=<nuevo|existente> stage=spec`.

## Etapa 1 — Ideación → Spec
Delega al agente **product-owner** con la idea y el slug. Espera `SPEC: docs/specs/<slug>.md`.
Muestra al usuario los criterios de aceptación y las preguntas abiertas. **COMPUERTA HUMANA**: pregunta si aprueba la spec o quiere cambios. No continúes sin un sí explícito.

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

## Reglas globales
- Cada vez que una compuerta rechaza, explica al usuario en 2 líneas qué falló y qué se va a reintentar.
- Si el usuario interrumpe con cambios de alcance, actualiza la spec (Etapa 1) antes de seguir.
- Al entrar en cada etapa ejecuta `node kit.js state stage=<etapa>` y, al recibir veredictos, `node kit.js state qa=APROBADO` / `codigo=…` / `seguridad=…` (claves permitidas en `node kit.js state` sin argumentos). Nunca edites `.pipeline/state.json` a mano. `/pipeline continuar <slug>` lee ese estado.
- Si `**la petición del usuario** (el texto que acompaña a la invocación de la skill)` empieza por `continuar`, lee el estado y retoma desde la etapa guardada.
