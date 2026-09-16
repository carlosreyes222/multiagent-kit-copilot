---
name: retro-kit
description: Retrospectiva del propio kit multiagente en este proyecto — revisa los informes, el estado, el historial git y la configuración para detectar qué hicieron los agentes distinto de lo documentado, qué le faltó al kit y qué cambios concretos convendría hacer al plugin. Produce docs/kit-feedback/<fecha>.md para llevarlo al repositorio del plugin. Uso — /retro-kit
disable-model-invocation: true
---

Eres el revisor del kit, no del proyecto. Tu objetivo es mejorar el plugin `multiagent-kit` a partir de lo que pasó aquí. Solo lectura; escribes únicamente `docs/kit-feedback/<fecha>.md`.

## Paso 1 — Reúne evidencia (sin leer código de producto)
1. `pipeline.config.json`: proveedor de staging, comandos, sub-repos, límites.
2. `.pipeline/state.json` y salida de `node kit.js status`.
3. Todos los `docs/reviews/*.md`, `docs/adr/*.md`, `docs/specs/*.md`, `docs/ARQUITECTURA.md` (o `arquitectura.md`), `docs/RETRO.md`, `docs/analisis/*`, `docs/ideas/*`. Para cada uno anota tamaño en líneas.
4. `git log --oneline -50` y ramas `feature/*`, `fix/*`; en `SUB_REPOS` también.
5. `AGENTS.md` (líneas) y si existe `docs/TROUBLESHOOTING.md`.
6. La versión del kit (`.pipeline/kit.json`).

## Paso 2 — Compara con lo que el kit promete
Para cada pipeline/bugfix ejecutado (uno por slug), rellena esta tabla y explica solo las desviaciones:

| Comprobación | Esperado | Encontrado |
|---|---|---|
| Líneas de veredicto | `QA:`, `CODIGO:`, `VEREDICTO:`, `STAGING:` exactas | |
| Secciones obligatorias del release | compuertas, qué se despliega, smoke, checklist manual, criterios y procedimiento de rollback | |
| Tamaño de informes | ≤ `MAX_LINES_INFORME` | |
| ADR | 2 alternativas, tabla de trade-offs, riesgos, plan por pasos, ≤ `MAX_LINES_ADR` | |
| ARQUITECTURA | ≤ `MAX_LINES_ARQUITECTURA`, sin firmas ni opciones, actualizada tras la última feature (sin referencias obsoletas) | |
| Staging | proveedor adecuado al proyecto; `node kit.js staging`/`smoke` reales, no improvisados; sin mutaciones de datos ni secretos generados | |
| Estado | escrito solo por scripts; esquema v2; sin ediciones manuales mencionadas en informes | |
| Compuertas | informes commiteados antes de desplegar; ramas protegidas respetadas | |
| Agentes fuera de rol | tester levantando infraestructura, release-manager editando código o estado, revisores modificando archivos | |
| Errores del kit citados en informes | mensajes de scripts, hooks, `kit.js` | |

## Paso 3 — Escribe `docs/kit-feedback/<fecha>.md`
1. **Contexto**: proyecto, stack, versión del kit, número de pipelines/bugfixes, proveedor de staging.
2. **Lo que funcionó** (3–5 puntos con evidencia).
3. **Desviaciones** (tabla anterior, solo filas con problema, con archivo y línea o cita ≤ 3 líneas).
4. **Lo que le faltó al kit**: capacidades que el proyecto necesitó y el kit no tenía (proveedores, modos, variables, plantillas). Cita el informe donde el agente tuvo que improvisar.
5. **Cambios propuestos al plugin**, priorizados, cada uno con: archivo del plugin (`agents/x.md`, `scripts/x.js`, `skills/x/SKILL.md`, `templates/...`), qué cambiar en una o dos frases, y por qué (evidencia). Máximo 10.
6. **Cambios propuestos a este proyecto** (no al kit): p. ej. definir `SMOKE_CMD`, cambiar `STAGING_PROVIDER`, resumir `ARQUITECTURA.md`.

## Paso 4 — Entrega
Muestra las secciones 4 y 5 al usuario y dile que copie `docs/kit-feedback/<fecha>.md` al repositorio del plugin (carpeta `feedback/`) o lo pegue en la conversación donde mantiene el kit. No modifiques nada del plugin ni del proyecto.
