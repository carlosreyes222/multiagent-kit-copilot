---
name: metodo-spec
description: Método para convertir una idea en una especificación funcional verificable (problema, usuarios, alcance mínimo, criterios Dado/Cuando/Entonces, fuera de alcance, preguntas abiertas). La usa el product-owner en la Etapa 1 del pipeline y cualquier agente que deba escribir o revisar una spec.
---

Aplica este método siempre que escribas o revises una spec. La plantilla (`docs/specs/_PLANTILLA.md`) dice qué secciones hay; este método dice cómo llenarlas bien.

## 1. Principios

- **Problema antes que solución.** La primera sección describe la necesidad del usuario sin mencionar pantallas, botones ni tecnología. Si la idea llegó como solución ("quiero un botón de exportar a Excel"), reconstruye el problema ("necesita compartir el informe con alguien que no usa la app") y anota la solución original como una opción, no como la única.
- **Alcance mínimo viable.** La spec cubre lo mínimo que resuelve el problema de punta a punta. Todo lo demás va a "Fuera de alcance" con una línea de por qué. Una feature que cabe en un pipeline (uno o dos días de trabajo) es el tamaño correcto; si no cabe, divide en dos specs y explica el orden.
- **Verificable o no existe.** Cada criterio de aceptación debe poder convertirse en una prueba automática sin interpretar. "Debe ser rápido" no es un criterio; "la lista de 500 elementos se muestra en menos de 1 s en un dispositivo de gama media" sí.
- **Asumir explícitamente.** Cuando algo es ambiguo y no puedes preguntar, elige la interpretación más simple, escríbela como "Asumido: …" en Preguntas abiertas, y diseña para que cambiarla sea barato.
- **Lenguaje del dominio.** Usa los términos que ya usa el proyecto (`AGENTS.md`, `docs/ARQUITECTURA.md`, specs anteriores). No inventes sinónimos.

## 2. Procedimiento

1. Lee `AGENTS.md`, `docs/ARQUITECTURA.md` y las specs existentes: evita duplicar una feature y respeta el vocabulario.
2. Escribe el problema en 2–4 frases y quién lo sufre. Si no puedes nombrar un usuario concreto, la feature no está justificada todavía: dilo.
3. Describe la solución desde el punto de vista del usuario, como un recorrido: qué ve, qué hace, qué obtiene. Sin detalles técnicos.
4. Deriva los criterios de aceptación del recorrido. Formato fijo: `CA-n — Dado <estado inicial>, cuando <acción>, entonces <resultado observable>`. Incluye siempre: el camino feliz, al menos un caso de error (red, datos inválidos, permisos) y al menos un borde (vacío, límite, duplicado).
5. Lista los requisitos no funcionales que apliquen con números: rendimiento, seguridad (qué datos son sensibles), accesibilidad, compatibilidad (versiones mínimas).
6. Escribe "Fuera de alcance" con lo que alguien podría esperar y no se hará.
7. Escribe "Preguntas abiertas" con lo que cambiaría el alcance si la respuesta fuera distinta, y lo asumido.
8. Relee comprobando: ¿cada criterio es una prueba? ¿hay alguna decisión técnica colada? ¿cabe en un pipeline?

## 3. Señales de una spec mala (corrígelas antes de entregar)

- Criterios con "debería", "adecuado", "correctamente", "rápido", "intuitivo".
- Más de 8–10 criterios: probablemente son dos features.
- Ningún caso de error ni borde.
- La solución nombra librerías, tablas o endpoints (eso es del ADR).
- "Fuera de alcance" vacío: siempre hay algo.

## 4. Al revisar una spec ajena

Comprueba los mismos puntos y devuelve hallazgos con el número de criterio afectado y una propuesta de redacción, no solo la objeción.

## 5. Complementos externos (si están instalados)

`product-management:write-spec` (Anthropic) para PRDs más amplios con métricas de éxito; `superpowers` → `brainstorming` para explorar el problema antes de fijar la spec; GitHub `spec-kit` (`/speckit.specify`, `/speckit.clarify`) si el proyecto lo usa — en ese caso la spec vive en `specs/<feature>/spec.md` y `docs/specs/<slug>.md` debe enlazarla en lugar de duplicarla.
