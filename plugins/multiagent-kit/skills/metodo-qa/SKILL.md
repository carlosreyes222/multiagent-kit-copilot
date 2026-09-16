---
name: metodo-qa
description: Método de QA — cómo convertir criterios de aceptación en pruebas, qué tipos de prueba escribir y en qué proporción, cómo encontrar bordes, cuándo una prueba es mala, y cómo reportar bugs reproducibles. Lo usa el tester en la Etapa 4 y cualquier agente que escriba o revise pruebas.
---

Aplica este método siempre que escribas, ejecutes o evalúes pruebas. Las pruebas demuestran que la feature cumple la spec y descubren lo que el implementador no cubrió; no están para "subir cobertura".

## 1. Principios

- **Un criterio, al menos una prueba.** La tabla criterio → prueba → estado es el corazón del informe. Un criterio sin prueba es un hallazgo BLOQUEANTE aunque el código parezca correcto.
- **Probar comportamiento, no implementación.** La prueba llama a la interfaz pública (función, endpoint, pantalla) y observa resultados; no espía llamadas internas ni asserts sobre detalles privados que cambiarían con un refactor legítimo.
- **Una prueba que falla es información, no un obstáculo.** Nunca se modifica una prueba para que pase ni se marca como skip. Si falla por un bug, se documenta el bug; si falla porque la spec cambió, se cambia la spec primero.
- **Pirámide.** Muchas unitarias rápidas (lógica, ViewModels, servicios), algunas de integración (endpoint con base de datos de prueba, pantalla con estado real), pocas E2E (solo si el ADR lo pide). Si algo solo se puede probar E2E, suele ser una señal de diseño que hay que reportar.
- **Deterministas.** Sin `sleep`, sin depender del reloj real, de la red ni del orden de ejecución. Fakes escritos a mano para dependencias propias; mocks solo para servicios externos.
- **El framework es el del proyecto.** Míralo en `AGENTS.md` o la skill de stack; si no hay ninguno, propón el estándar del lenguaje y anótalo en el informe.

## 2. Procedimiento

1. Lee spec, ADR, `docs/ARQUITECTURA.md` y la skill de stack para saber dónde viven las pruebas y qué contratos existen.
2. Por cada criterio de aceptación escribe la prueba del camino feliz tal como lo describe la spec.
3. Añade bordes con esta lista: vacío / nulo / cadena en blanco; mínimo y máximo; uno más que el máximo; duplicado; caracteres especiales y Unicode; sin permisos; sin red o tiempo de espera agotado; respuesta con error del servidor; dos operaciones concurrentes; repetir la misma acción dos veces (idempotencia).
4. Añade pruebas de regresión para cada bug encontrado en esta feature.
5. Ejecuta con el `TEST_CMD` de `pipeline.config.json`. Ejecuta dos veces: una prueba que pasa y luego falla es un bug de la prueba y se reporta.
6. Escribe el informe (§5). Si algo falla, reporta el bug con el formato de §4; no lo arregles tú.

## 3. Prueba roja (reproducir un bug antes de corregirlo)
Se usa en `/bugfix` y siempre que llegue un bug sin prueba que lo demuestre.
1. Reúne la evidencia original (descripción, pasos, traza, versión, entorno) y guárdala íntegra en el informe.
2. Reproduce manual o automáticamente en el entorno más pequeño posible (una unitaria antes que un E2E). Si depende de datos concretos, fíjalos en la prueba.
3. Escribe la prueba que **falla por la causa del bug**, con nombre que describa el comportamiento esperado (no "test_bug_123"). Comprueba que falla por el motivo correcto leyendo el mensaje de fallo, no solo porque falla.
4. Localiza la causa probable siguiendo el camino de ejecución desde la prueba hasta el código (archivo:línea). Distingue causa raíz de síntoma: si el arreglo obvio solo oculta el síntoma, dilo.
5. Termina con `REPRODUCIDO: SÍ` (prueba roja + causa probable) o `REPRODUCIDO: NO` (qué intentaste, qué te faltó: datos, versión, entorno). Nunca inventes una reproducción.
Tras la corrección, la misma prueba debe pasar sin cambios, y se añaden variantes cercanas (mismo patrón en otros sitios) como regresión.

## 4. Formato de reporte de bug

```
### BUG-n — Título (severidad: bloquea criterio CA-x | menor)
**Pasos:** 1. … 2. … 3. …
**Datos:** entrada exacta usada.
**Esperado:** según CA-x, …
**Obtenido:** …
**Prueba que lo demuestra:** tests/…/nombre_test (falla)
**Sospecha de causa (opcional):** archivo:línea
```

## 5. Formato del informe (`docs/reviews/<slug>-qa.md`)

1. Primera línea útil: `QA: APROBADO` o `QA: RECHAZADO`.
2. Tabla: criterio → prueba(s) → PASA / FALLA / SIN PRUEBA.
3. Bugs encontrados (§3), ordenados por severidad.
4. Bordes cubiertos y bordes que quedaron fuera, con motivo.
5. Comando de ejecución y tiempo total de la suite (si crece mucho, decirlo).

## 6. Señales de pruebas malas (corrígelas)

- Asserts sobre número de llamadas o emisiones en lugar de sobre el estado final.
- Pruebas que replican la lógica del código para calcular el esperado.
- Una prueba gigante que cubre cinco criterios.
- Nombres que no dicen el comportamiento (`test1`, `testLogin`): usar "dado_cuando_entonces" o frase completa.
- Dependencia de datos reales, de la hora actual o del orden.

## 7. Complementos externos (si están instalados)

`engineering:testing-strategy` (Anthropic) para diseñar la estrategia de un proyecto entero; `petrkindlmann/qa-skills` → `test-strategy`, `test-planning`, `risk-based-testing`, `exploratory-testing`, `bug-reproduction`, `release-readiness`; `superpowers` → `test-driven-development` si el implementador quiere trabajar en TDD; las skills de stack indican el framework y las reglas de pruebas de cada tecnología.
