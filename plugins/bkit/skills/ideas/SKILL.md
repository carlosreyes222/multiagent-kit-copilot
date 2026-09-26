---
name: ideas
description: Pide al equipo que proponga mejoras y nuevas ideas — de producto (product-owner), de mercado investigando productos y proyectos similares (investigador, con búsqueda web) y técnicas (arquitecto, revisores) — priorizadas por impacto y esfuerzo y listas para /pipeline. Uso — /ideas · /ideas "dirección" · /ideas --producto "…" · /ideas --mercado "…" · /ideas --tecnico "…"
disable-model-invocation: true
---

Eres el coordinador de una sesión de propuestas. El objetivo es que salgan ideas **concretas para este proyecto**, no consejos genéricos. Dirección dada por el usuario (puede estar vacía): **la petición del usuario** (el texto que acompaña a la invocación de la skill)

## Cómo delegar (GitHub Copilot)
Cada etapa la hace un **agente personalizado del kit** (`product-owner`, `arquitecto`, `implementador`, `tester`, `revisor-codigo`, `revisor-seguridad`, `release-manager`, `investigador`). Delega con la herramienta de subagentes (`task`/`agent` en la CLI de Copilot y en el cloud agent; `runSubagent` en VS Code) indicando el nombre del agente, la instrucción completa y las rutas de entrada. Espera su línea final de veredicto antes de seguir. Si en tu entorno no puedes lanzar subagentes, pide al usuario que ejecute la etapa con `@<agente>` (VS Code) o `copilot --agent <agente> -p "..."` (CLI) y pégate el resultado.

## Paso 0 — Contexto
1. Lee `AGENTS.md`, `docs/ARQUITECTURA.md`, las specs en `docs/specs/`, `docs/RETRO.md` y los últimos informes en `docs/analisis/` y `docs/reviews/` si existen. Si no hay `docs/ARQUITECTURA.md` en un proyecto con código, pide primero un `/analisis` o deja que el arquitecto lo cree.
2. Detecta el **modo** al inicio de `**la petición del usuario** (el texto que acompaña a la invocación de la skill)` (quítalo del texto):
   - `--producto`: solo product-owner e investigador (ideas para el usuario final; sin técnicas).
   - `--mercado`: investigador primero (benchmark de productos y proyectos similares en la web), después product-owner adapta; sin técnicas.
   - `--tecnico`: solo arquitecto y revisores.
   - sin modo (por defecto): **equilibrado**: product-owner + investigador + arquitecto + revisores, y la consolidación debe garantizar al menos la mitad de ideas de producto/mercado.
   Interpreta la dirección restante como pregunta guía ("usuarios nuevos", "costes", "para familias con niños"). Si no hay nada, la pregunta guía es: "¿Qué es lo más valioso que este proyecto podría hacer a continuación para sus usuarios, y qué le está frenando?"
3. Confirma la pregunta guía al usuario en una línea y continúa.

## Paso 1 — Propuestas en paralelo (cada agente 5 ideas como máximo; investigador hasta 8)
Lanza **al mismo tiempo** a los agentes del modo, cada uno escribiendo en `docs/ideas/<fecha>-{mercado,producto,arquitectura,calidad,seguridad}.md`:
- **investigador** (modos por defecto, `--producto`, `--mercado`): benchmark en fuentes externas de productos y proyectos similares (comerciales, open source, tiendas de apps, reseñas): matriz referente × funcionalidad, qué tenemos y qué no, y hasta 8 propuestas **adaptadas** a este proyecto con URL de origen, esfuerzo, riesgo (privacidad, legal) y métrica. En modo `--mercado`, espera a que termine y pásale su informe al product-owner para que lo aterrice antes de consolidar.
- **product-owner**: ideas de producto: nuevas capacidades, cambios de flujo, cosas que los usuarios probablemente piden o sufren. Cada idea con: a quién sirve, qué problema resuelve, cómo sabríamos que funcionó (una métrica), y una spec de una frase. Debe apoyarse en las specs existentes para no proponer lo que ya hay.
- **arquitecto**: mejoras estructurales: módulos a profundizar, decisiones vigentes que ya estorban, deuda de `ARQUITECTURA.md`, cambios que harían más fácil las ideas de producto (si ya conoce la dirección). Cada una con esfuerzo y riesgo.
- **revisor-codigo**: mejoras de calidad y velocidad de desarrollo: pruebas que faltan, duplicación, herramientas (lint, CI), cosas que hacen lentos los pipelines.
- **revisor-seguridad**: endurecimientos pendientes y riesgos por exposición futura (más usuarios, más datos), ordenados por severidad.

Instrucción común: evidencia del proyecto (archivo, spec o informe) en cada idea; nada que no se pueda señalar en el código o en los documentos. Prohibido proponer "adoptar la librería X" sin decir qué problema concreto de este proyecto resuelve.

## Paso 2 — Consolidación y priorización
Escribe `docs/ideas/<fecha>.md`:
1. Tabla única de ideas (máx. 15 tras eliminar duplicados y las que ya existen): id, idea en una frase, tipo (mercado / producto / arquitectura / calidad / seguridad), origen (referente con URL si viene del benchmark), impacto (alto/medio/bajo) con una justificación de 5 palabras, esfuerzo (S/M/L), dependencias. **Regla de equilibrio**: en modo por defecto, al menos la mitad de las filas son de tipo mercado o producto; si las técnicas sobran, van a un anexo "Técnicas adicionales", no a la tabla principal.
2. **Tres recomendaciones** para empezar: la de mayor impacto con esfuerzo S o M, la que desbloquea más ideas, y la que reduce más riesgo. Explica cada una en 3 líneas.
3. **Comando para cada idea** cuando el usuario quiera lanzarla: `/pipeline "…"` (con la frase de spec ya escrita), `/bugfix "…"` si es un defecto, `/analisis "…"` si primero hay que entender algo.
4. **Descartadas y por qué** (breve): las ideas que los agentes propusieron y no pasaron el filtro de evidencia o ya existen.

## Paso 3 — Conversación
Presenta la tabla y las tres recomendaciones. Pregunta al usuario cuáles le interesan, cuáles descarta y si quiere combinar alguna. Con su respuesta, actualiza `docs/ideas/<fecha>.md` marcando las elegidas y ofrece lanzar la primera con su comando. No lances nada sin que lo pida.

## Reglas
- Solo lectura durante toda la sesión, salvo escribir en `docs/ideas/`.
- El investigador cita URL en cada dato externo; las propuestas se adaptan, nunca se copian textos, marcas ni recursos de otros productos.
- Las ideas de producto no deben contradecir "Fuera de alcance" de specs existentes sin decirlo explícitamente ("esto se descartó en la spec X; proponerlo de nuevo porque…").
- Si el usuario pide ideas para un público concreto (p. ej. niños, un equipo del banco), el product-owner debe describir a ese usuario antes de proponer.
- Si `docs/RETRO.md` registra bugs recurrentes, al menos una idea de calidad debe atacar la causa común.
