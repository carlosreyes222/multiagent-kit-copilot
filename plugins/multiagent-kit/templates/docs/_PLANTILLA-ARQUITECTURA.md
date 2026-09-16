# Arquitectura de <nombre del proyecto>

> Documento VIVO. Lo mantiene el agente `arquitecto` al cierre de cada feature (Etapa 7 del pipeline).
> Es la primera lectura obligatoria de cualquier agente antes de tocar el proyecto. Si editas código por fuera del pipeline, actualízalo tú.
> Máximo 300 líneas. Es un MAPA, no una referencia de API: nada de firmas, opciones con valores por defecto ni esquemas completos.

**Última actualización:** <AAAA-MM-DD> · **Feature:** `<slug>` · **Stack:** ver `docs/adr/0000-stack.md`

## Resumen en 5 líneas
Qué es el sistema, para quién, y cómo está organizado a grandes rasgos.

## Mapa de módulos
| Módulo / carpeta | Responsabilidad | Depende de | Punto de entrada |
|---|---|---|---|
| `src/…` | … | … | … |

## Flujo principal
Cómo viaja una petición o acción típica de extremo a extremo (texto o diagrama ASCII).

## Contratos
APIs, eventos, modelos de datos y esquemas que otros módulos consumen. Solo lo que un agente necesita saber para no romper nada.

## Decisiones vigentes
| Decisión | Por qué | ADR |
|---|---|---|
| … | … | `docs/adr/<slug>.md` |

## Convenciones específicas
Lo que no es obvio desde el código: nombres, capas, manejo de errores, dónde van las pruebas.

## Deuda técnica conocida
- … (origen: feature `<slug>`)

## Historial (decisiones superadas)
- <fecha> — <decisión> reemplazada por <decisión> (ADR …)
