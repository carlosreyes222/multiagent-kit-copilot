# 5. Arquitectura viva

## 5.1 El problema que resuelve

Con veinte features hechas, cada una deja su ADR. Un agente que quiera entender el proyecto tendría que leer veinte ADRs o explorar todo el código. `docs/ARQUITECTURA.md` es el resumen **vigente** del sistema, y es la primera lectura de todos los agentes.

## 5.2 Qué contiene

Sigue `docs/_PLANTILLA-ARQUITECTURA.md`:

- Resumen en 5 líneas.
- Mapa de módulos (responsabilidad, dependencias, punto de entrada).
- Flujo principal de extremo a extremo.
- Contratos: APIs, eventos, modelos que otros módulos consumen.
- Decisiones vigentes, cada una enlazada a su ADR.
- Convenciones específicas del proyecto.
- Deuda técnica conocida (con la feature que la originó).
- Historial de decisiones superadas.

## 5.3 Quién lo mantiene y cuándo

- **Etapa 7 del pipeline (obligatoria):** al cerrar cada feature, el arquitecto en `MODO: DOCUMENTAR` compara el documento con lo realmente implementado y lo actualiza. También actualiza `AGENTS.md` si cambió alguna convención.
- **Primera feature en un proyecto con código:** si no existe, el arquitecto lo crea explorando el código antes de diseñar.
- **Proyecto vacío:** se crea al aceptar el stack, con los módulos previstos.
- **Si editas código por fuera del pipeline:** actualízalo tú, o pide `@arquitecto MODO: DOCUMENTAR`.

## 5.4 Sin memoria entre sesiones

Los agentes de Copilot no conservan memoria privada entre sesiones (la CLI tiene una memoria del repositorio que solo escribe el agente raíz). Por eso en este kit el documento de arquitectura es la **única** memoria: el arquitecto y los revisores dejan escrito en `docs/ARQUITECTURA.md` y en `docs/reviews/` lo que en el kit de Claude Code guardaban en su memoria de proyecto.

## 5.5 Límite honesto

Los agentes siempre leen *algo* de código: implementar o revisar sin mirar los archivos concretos sería adivinar. Lo que la arquitectura documentada consigue es que lean lo justo (los dos o tres módulos afectados) y decidan con el contexto correcto. Y como cualquier documento, se desactualiza si alguien cambia código sin pasar por el pipeline; por eso la Etapa 7 es obligatoria y no opcional.

---
Anterior: [04-flujo-y-compuertas.md](04-flujo-y-compuertas.md) · Siguiente: [06-actualizar-el-kit.md](06-actualizar-el-kit.md) · [Índice](../README.md)
