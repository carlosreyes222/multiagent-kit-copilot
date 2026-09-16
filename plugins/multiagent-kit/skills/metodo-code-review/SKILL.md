---
name: metodo-code-review
description: Método de revisión de código basado en evidencia — qué revisar y en qué orden, taxonomía de severidad, cómo redactar cada hallazgo (archivo:línea, por qué importa, cómo corregir) y el formato del informe con veredicto. Lo usan revisor-codigo y revisor-seguridad en la Etapa 5, y cualquier agente al que se le pida revisar un diff o PR.
---

Aplica este método en toda revisión de código. Es solo lectura: un revisor nunca modifica archivos.

## 1. Principios

- **Evidencia, no opinión.** Cada hallazgo cita archivo y línea, describe el fallo concreto y, si es un bug, el escenario que lo provoca (entrada → resultado incorrecto). Si no puedes mostrar cómo falla, no es BLOQUEANTE; como mucho es SUGERENCIA.
- **Verificar antes de afirmar.** Antes de reportar un stale closure, una condición de carrera o un N+1, sigue el camino de ejecución en el código y compruébalo. Los revisores que "sospechan" generan ruido y pierden credibilidad.
- **Contra la spec y el ADR, no contra tu gusto.** La primera pregunta es si el cambio hace lo que la spec pide y como el ADR decidió. Estilo y preferencias personales no bloquean; las convenciones escritas (`AGENTS.md`, skills de stack) sí.
- **Versiones antes que consejos.** Comprueba las versiones reales de librerías antes de sugerir una API o marcar algo como obsoleto.
- **Pocas cosas, importantes.** Tres bloqueantes bien explicados valen más que treinta comentarios. Agrupa los repetitivos ("mismo patrón en 6 archivos: …").

## 2. Orden de revisión

1. **Alcance:** ¿el diff hace solo lo que dice? ¿Hay cambios no relacionados, archivos generados, secretos, dependencias nuevas sin justificar?
2. **Corrección:** cumplimiento de cada criterio de aceptación; lógica; bordes (vacío, nulo, límite, duplicado, concurrencia); manejo de errores (¿se traga excepciones? ¿mensajes útiles?).
3. **Seguridad (siempre, aunque exista revisor dedicado):** entradas externas validadas, autorización por recurso, secretos, logs con datos sensibles, dependencias vulnerables.
4. **Pruebas:** ¿existen para cada criterio? ¿prueban comportamiento o implementación? ¿alguna se modificó para que pase?
5. **Diseño y mantenibilidad:** respeto al ADR y a `docs/ARQUITECTURA.md`; duplicación; complejidad innecesaria; nombres; acoplamiento nuevo entre módulos.
6. **Rendimiento:** solo con evidencia (consulta en bucle, trabajo en hilo principal, lista sin claves, allocations en render). No pedir memoización o caché sin un problema medido.

## 3. Severidad

| Nivel | Significado | Efecto |
|---|---|---|
| **BLOQUEANTE** | Bug demostrable, incumplimiento de la spec/ADR, vulnerabilidad, prueba ausente para un criterio, secreto en código | Veredicto RECHAZADO |
| **IMPORTANTE** | Riesgo real pero no demostrado como fallo, deuda que crecerá, prueba débil | No bloquea; debe quedar registrado como deuda si no se corrige |
| **SUGERENCIA** | Claridad, nombres, pequeñas simplificaciones | Opcional |

En el informe de seguridad las severidades son CRÍTICA/ALTA (bloqueantes), MEDIA, BAJA.

## 4. Formato de cada hallazgo

```
### [BLOQUEANTE] Título corto
**Dónde:** src/auth/login.service.ts:42
**Qué:** el token se genera antes de comprobar que el usuario está activo.
**Por qué importa:** un usuario desactivado obtiene un JWT válido durante 15 min.
**Cómo corregir:** mover la comprobación `user.isActive` antes de `jwt.sign(...)` y añadir prueba "usuario inactivo → 401".
```

## 5. Formato del informe (`docs/reviews/<slug>-codigo.md` o `-seguridad.md`)

1. Veredicto en la primera línea útil (`CODIGO: APROBADO|RECHAZADO` o `VEREDICTO: APROBADO|RECHAZADO` en seguridad).
2. Resumen en 3 líneas: qué se revisó (rama, número de archivos), qué está bien, qué bloquea.
3. Hallazgos ordenados por severidad, con el formato anterior.
4. Tabla criterio de aceptación → cumplido / no / sin prueba.
5. Lo que NO se revisó y por qué (p. ej. código generado).

## 6. Al recibir una revisión (implementador)

Atiende todos los BLOQUEANTES; para cada uno, di qué cambiaste o por qué no procede (con evidencia). No "corrijas" modificando la prueba para que pase. Si un hallazgo revela un problema del ADR, dilo en "Desviaciones" y no lo resuelvas en silencio.

## 7. Complementos externos (si están instalados)

`engineering:code-review` (Anthropic) para revisiones con foco en seguridad/rendimiento; `superpowers` → `requesting-code-review` y `receiving-code-review` para el ida y vuelta; las skills de stack (`stack-*`) traen la lista de verificación específica de cada tecnología: úsala siempre que aplique.
