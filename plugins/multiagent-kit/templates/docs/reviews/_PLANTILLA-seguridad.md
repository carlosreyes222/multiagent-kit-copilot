# Revisión de seguridad: <slug>

**Rama:** `feature/<slug>` · **Revisor:** revisor-seguridad · **Fecha:** <AAAA-MM-DD>

VEREDICTO: RECHAZADO
COMMIT: <sha revisado>

> Sustituye la línea de veredicto por `VEREDICTO: APROBADO` o `VEREDICTO: RECHAZADO` (una sola en todo el informe) y
> `<sha revisado>` por `git log -1 --format=%h`. `kit pr` y el hook de merge las leen literalmente.

## Resumen
Una frase con el estado general.

## Hallazgos

| # | Severidad | Ubicación | Descripción | Corrección |
|---|-----------|-----------|-------------|------------|
| 1 | CRÍTICA / ALTA / MEDIA / BAJA | archivo:línea | … | … |

CRÍTICA y ALTA son bloqueantes.

## Riesgos del ADR verificados

| Riesgo | Mitigado | Evidencia |
|--------|----------|-----------|
| R-1 | sí / no | … |

## Dependencias auditadas
Comando usado y resultado.
