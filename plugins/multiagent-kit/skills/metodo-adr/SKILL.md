---
name: metodo-adr
description: Método para tomar y documentar decisiones de arquitectura (ADR) — cuándo abrir uno, cómo comparar alternativas con trade-offs reales, declarar riesgos y convertir la decisión en un plan de implementación por pasos verificables. La usa el arquitecto en la Etapa 2 y en modo DOCUMENTAR.
---

Aplica este método al escribir o revisar un ADR. La plantilla (`docs/adr/_PLANTILLA.md`) fija las secciones; esto fija el criterio.

## 1. Cuándo hace falta un ADR

Un ADR por feature siempre (es la entrada del implementador). Además, un ADR **independiente** cuando una decisión afecta a más de una feature o es cara de deshacer: elección de stack o librería transversal, esquema de datos compartido, contrato de API público, estrategia de autenticación, estructura de módulos, estrategia de despliegue. Numera los transversales (`0000-stack.md`, `0001-auth.md`…) y los de feature por slug.

No abras un ADR para decisiones locales y reversibles (nombre de una función, orden de parámetros): eso es una convención y va en `AGENTS.md` si merece la pena.

## 2. Principios

- **Diseñar dos veces.** Antes de elegir, describe al menos dos alternativas razonables con el mismo nivel de detalle. Si solo se te ocurre una, busca la opuesta (embeber vs. referenciar, síncrono vs. asíncrono, librería vs. código propio, ahora vs. después). La segunda opción existe para hacer visible el coste de la primera.
- **Trade-offs concretos, no adjetivos.** "Más escalable" no vale; "soporta 10× usuarios sin cambiar el esquema, a cambio de dos tablas más y una migración" sí. Para cada alternativa: qué se gana, qué se pierde, qué se vuelve difícil de cambiar después.
- **Respetar lo existente.** Lee `docs/ARQUITECTURA.md` y los ADR previos. No re-litigues una decisión vigente dentro de un ADR de feature; si de verdad hay que cambiarla, abre un ADR transversal que la supersede y explica qué la invalidó.
- **Reversibilidad primero.** Ante empate, elige la opción más fácil de deshacer. Anota el plan de salida de cada decisión cara.
- **Los riesgos se declaran, no se descubren.** Enumera riesgos de seguridad (datos sensibles, entradas externas, permisos), de rendimiento y de operación, con su mitigación. El revisor de seguridad verificará uno por uno.
- **Versiones fijadas con fecha.** Si el ADR introduce librerías, consulta las URLs oficiales de la skill de stack correspondiente y anota versión exacta y fecha de consulta.

## 3. Procedimiento

1. Contexto: restricciones reales del código, la spec y el entorno (2–5 líneas). Enlaza los ADR previos que condicionan.
2. Alternativas: dos o más, mismo nivel de detalle, tabla de trade-offs.
3. Decisión: cuál y por qué, en una frase, y qué trade-off se acepta conscientemente.
4. Diseño: componentes, flujo de datos, contratos (firmas, modelos, eventos). Un diagrama en texto si hay más de tres piezas.
5. Riesgos con mitigación (R-1, R-2…).
6. Plan de implementación: pasos pequeños y ordenados; cada paso nombra archivos a crear/modificar y la prueba que lo verifica. El primer paso debe dejar el sistema funcionando (sin big-bang). Marca los pasos que el tester debe cubrir con pruebas nuevas.
7. Consecuencias: qué se vuelve fácil, qué difícil, qué deuda se asume y cuándo se paga.

## 4. Señales de un ADR malo

- Una sola alternativa, o la segunda es de paja ("no hacer nada").
- Trade-offs sin números ni consecuencias concretas.
- Plan de implementación de un solo paso o sin archivos.
- Riesgos de seguridad ausentes en una feature que toca datos de usuario, auth o entradas externas.
- Contradice `docs/ARQUITECTURA.md` sin decirlo.

## 5. En MODO DOCUMENTAR

Al cerrar la feature, mueve a "Historial" de `docs/ARQUITECTURA.md` las decisiones que este ADR superó, añade las nuevas a "Decisiones vigentes" con enlace, y registra la deuda asumida con la feature que la originó.

## 6. Complementos externos (si están instalados)

`engineering:architecture` (Anthropic) para ADR más formales o revisiones de diseño; `mattpocock-skills` → `codebase-design` y `improve-codebase-architecture` para detectar módulos poco profundos y proponer refactors (requiere su plugin completo y un `CONTEXT.md`; si el proyecto no lo tiene, usa `docs/ARQUITECTURA.md` como glosario); `engineering:tech-debt` para auditorías de deuda.
