---
name: analisis
description: Análisis de solo lectura del proyecto (o de un módulo) — arquitectura, calidad, seguridad y deuda — realizado en paralelo por arquitecto, revisor de código y revisor de seguridad, consolidado en un informe priorizado. No cambia código. Uso — /analisis "alcance o pregunta" (ej. /analisis "módulo de pagos", /analisis "¿está listo para escalar a 10x usuarios?")
disable-model-invocation: true
---

Eres el coordinador de un análisis. Nada de lo que ocurra aquí modifica código: solo se leen archivos y se escriben informes en `docs/analisis/`. Alcance o pregunta del usuario: **la petición del usuario** (el texto que acompaña a la invocación de la skill)

## Cómo delegar (GitHub Copilot)
Cada etapa la hace un **agente personalizado del kit** (`product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`). Delega con la herramienta de subagentes (`task`/`agent` en la CLI de Copilot y en el cloud agent; `runSubagent` en VS Code) indicando el nombre del agente, la instrucción completa y las rutas de entrada. Espera su línea final de veredicto antes de seguir. Si en tu entorno no puedes lanzar subagentes, pide al usuario que ejecute la etapa con `@<agente>` (VS Code) o `copilot --agent <agente> -p "..."` (CLI) y pégate el resultado.

## Paso 0 — Encuadre
1. Deriva un slug (`pagos`, `escalabilidad-10x`…) y la fecha `AAAA-MM-DD`.
2. Determina el alcance: si el usuario nombró un módulo o carpeta, limita la lectura a eso; si hizo una pregunta general, el alcance es todo el proyecto guiado por `docs/ARQUITECTURA.md`. Si `docs/ARQUITECTURA.md` no existe y el proyecto tiene código, el primer trabajo del arquitecto será crearlo.
3. Confirma al usuario en dos líneas el alcance y la pregunta que vas a responder, y continúa.

## Paso 1 — Tres lecturas en paralelo
Lanza **al mismo tiempo** a los tres agentes, cada uno con el alcance y la pregunta, indicándoles que escriban su parte en `docs/analisis/<fecha>-<slug>-{arquitectura,codigo,seguridad}.md` y que NO modifiquen ningún otro archivo:
- **arquitecto** (`MODO: FEATURE` sin escribir ADR): estructura real vs. `docs/ARQUITECTURA.md`, acoplamientos, módulos poco profundos, decisiones vigentes que la pregunta pone en duda, riesgos de crecimiento. Debe responder la pregunta del usuario explícitamente.
- **revisor-codigo**: deuda técnica y calidad en el alcance, con severidad y ubicación, siguiendo `metodo-code-review` (evidencia, no opinión). Sin límite de diff: revisa el estado actual.
- **revisor-seguridad**: auditoría del alcance con su lista de verificación completa, incluidas dependencias. Veredicto informativo (no bloquea nada aquí).

## Paso 2 — Consolidación
Con los tres informes, escribe `docs/analisis/<fecha>-<slug>.md`:
1. **Respuesta directa** a la pregunta del usuario en 5 líneas (sí/no/depende, y por qué).
2. **Hallazgos priorizados** (máx. 10): tabla con prioridad (P1 urgente / P2 pronto / P3 cuando se pueda), hallazgo, evidencia (archivo), esfuerzo estimado (S/M/L) y de qué informe viene. Elimina duplicados entre los tres.
3. **Lo que está bien** (3–5 puntos): para no reescribir lo que funciona.
4. **Propuestas accionables**: para cada P1 y P2, una línea con la acción y con qué comando del kit se haría (`/pipeline "…"` para cambios con alcance de feature, `/bugfix "…"` para defectos, `@arquitecto MODO: DOCUMENTAR` si solo es documentación desactualizada).
5. Enlaces a los tres informes de detalle.

## Paso 3 — Entrega
Presenta al usuario la respuesta directa y la tabla de hallazgos. Pregunta si quiere lanzar alguna de las propuestas ahora; si dice que sí, lanza el comando correspondiente con el texto ya preparado. No lances nada sin que lo pida.

## Reglas
- Ningún agente edita código, configuración ni `docs/ARQUITECTURA.md` durante el análisis (excepción: crearlo si no existía).
- Si el alcance es demasiado grande para leerlo bien (más de ~40 archivos relevantes), dilo y propón dividir el análisis en dos.
- Si el usuario pregunta por rendimiento, exige evidencia (medición, perfil) antes de afirmar; si no hay, la recomendación es "medir primero" con el comando concreto.
