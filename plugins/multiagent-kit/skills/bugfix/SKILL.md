---
name: bugfix
description: Pipeline corto para bugs — reproducir, escribir la prueba que falla, corregir en rama fix/*, QA con regresión, revisiones, staging — con compuerta de reproducción y modo urgente para hotfixes. Uso — /bugfix "descripción, pasos o traza" · /bugfix --solo-diagnostico "…" · /bugfix --urgente "…"
disable-model-invocation: true
---

Eres el coordinador de la corrección de un bug. Entrada del usuario: **la petición del usuario** (el texto que acompaña a la invocación de la skill)

## Cómo delegar (GitHub Copilot)
Cada etapa la hace un **agente personalizado del kit** (`product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`). Delega con la herramienta de subagentes (`task`/`agent` en la CLI de Copilot y en el cloud agent; `runSubagent` en VS Code) indicando el nombre del agente, la instrucción completa y las rutas de entrada. Espera su línea final de veredicto antes de seguir. Si en tu entorno no puedes lanzar subagentes, pide al usuario que ejecute la etapa con `@<agente>` (VS Code) o `copilot --agent <agente> -p "..."` (CLI) y pégate el resultado.

## Paso 0 — Encuadre
1. Detecta modificadores al inicio de `**la petición del usuario** (el texto que acompaña a la invocación de la skill)`: `--solo-diagnostico` (termina tras el Paso 1), `--urgente` (hotfix: ver "Modo urgente"). Quítalos del texto.
2. **Ticket de Jira**: si el texto contiene `abc-123`, es el ticket: MAYÚSCULAS, quítalo del texto y el slug pasa a ser `<TICKET>-<descripcion>` (ej. `BMOSHELL-124-login-null-token`); rama `fix/<slug>`, commits `fix: BMOSHELL-124 descripción`; registra `node kit.js state ticket=<TICKET>`. Sin ticket, slug normal (`login-null-token`). Registra: `node kit.js state feature=fix-<slug> type=bugfix stage=reproducir`.
3. Si el usuario pegó una traza o log, consérvalo íntegro en `docs/reviews/fix-<slug>-qa.md` (sección "Evidencia original").
4. Si `AGENTS.md` lista skills de stack, indícalo a cada agente.

## Paso 1 — Reproducir (tester)
Delega al **tester**: reproducir el bug siguiendo la sección "Prueba roja" de `metodo-qa`; escribir una prueba automática que falle por la causa del bug (no por otra cosa); documentar en `docs/reviews/fix-<slug>-qa.md` pasos, datos, esperado vs. obtenido, la prueba, y una **causa probable** con archivo:línea. Si instalado, puede apoyarse en `engineering:debug` o `superpowers` → `systematic-debugging`.

**COMPUERTA**: si el tester responde `REPRODUCIDO: NO`, detente, muestra lo que intentó y pregunta al usuario por más datos (versión, entorno, datos exactos). No se corrige lo que no se reproduce.
Si es `--solo-diagnostico`, presenta el informe y termina aquí.

## Paso 2 — Corregir (implementador)
Delega al **implementador** con el informe de QA: rama `fix/<slug>` desde `main` (o la rama base del proyecto), corrección mínima que ataque la causa raíz (no el síntoma), sin modificar la prueba roja, y sin refactors oportunistas — si ve uno necesario, lo anota en "Desviaciones" para un `/pipeline` posterior. Espera `IMPLEMENTADO: fix/<slug>`.

## Paso 3 — QA de regresión (tester)
El tester ejecuta la prueba roja (debe pasar ahora), toda la suite, y añade pruebas para variantes cercanas del bug (mismo patrón en otros sitios). `QA: RECHAZADO` → vuelve al Paso 2 (máx. 2 veces).

## Paso 4 — Revisiones (en paralelo)
**revisor-codigo** y **revisor-seguridad** sobre `fix/<slug>`. El revisor de código comprueba además que el cambio es mínimo y no introduce comportamiento nuevo. Ambos APROBADOS o vuelve al Paso 2.

## Paso 5 — Staging
**release-manager**: `kit.js staging --feature fix-<slug>` + `node kit.js smoke`, y un smoke específico que ejercite el escenario del bug.

## Paso 6 — Entrega y aprendizaje
1. Resumen: causa raíz en una frase, archivos tocados, prueba de regresión, URL de staging, comando `node kit.js prod`.
2. Añade una entrada en `docs/RETRO.md` (créalo si no existe): fecha, bug, causa raíz, cómo se detectó, qué lo habría evitado (una regla concreta). Si esa regla es general, propón al usuario añadirla a `AGENTS.md` o a la skill de stack.
3. Si la causa raíz revela un problema de diseño, propón `/analisis "<módulo>"`.

## Modo urgente (`--urgente`)
Para hotfixes en producción. Se mantienen: reproducir (Paso 1, aunque sea manual y documentado), corrección mínima, revisor de seguridad, smoke test en staging. Se pueden omitir: revisor de código y pruebas de variantes, **solo si el usuario lo confirma explícitamente** cuando se lo preguntes. Todo lo omitido se registra en `docs/reviews/fix-<slug>-release.md` bajo "Compuertas omitidas por urgencia" con la fecha, y se crea una entrada en `docs/RETRO.md` con la deuda de completarlas. La promoción sigue siendo humana (`node kit.js prod`).

## Reglas
- Nunca "arreglar" un bug cambiando o desactivando la prueba que lo demuestra.
- Nunca ampliar el alcance: un bug, una rama, una corrección.
- Si durante la reproducción aparece un segundo bug, se anota en `docs/RETRO.md` como pendiente y se sigue con el original.
