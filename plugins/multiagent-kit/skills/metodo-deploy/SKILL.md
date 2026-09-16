---
name: metodo-deploy
description: Método de despliegue seguro — lista de verificación antes de staging y antes de producción, manejo de migraciones y feature flags, smoke tests, criterios y plan de rollback, y qué debe comprobar a mano la persona que aprueba. Lo usa el release-manager en la Etapa 6 y la persona que ejecuta kit.js prod.
---

Aplica este método en cada despliegue. Regla de oro: **producción la promueve siempre una persona**; los agentes preparan, verifican y documentan.

## 1. Principios

- **Lo que no se puede deshacer se hace en dos pasos.** Migraciones destructivas, cambios de contrato de API y renombrados de campos se despliegan primero de forma compatible (añadir), y solo en un despliegue posterior se elimina lo viejo. Nunca "borrar y crear" en el mismo release.
- **Cambios de código y cambios de datos, separados.** Una migración de esquema va en su propio commit y se prueba en staging con datos parecidos a producción antes de tocar código que dependa de ella.
- **Feature flags para lo grande.** Una feature que cambia el comportamiento visible para muchos usuarios se despliega apagada y se enciende por separado; así el rollback es apagar el flag, no revertir el despliegue.
- **Rollback definido antes de desplegar, no durante el incidente.** El informe de release dice qué señal dispara el rollback y cuál es el comando exacto.
- **Staging es la prueba, no un trámite.** Si staging no reproduce la configuración de producción en lo que importa (variables, versión de base de datos, tamaño de datos), dilo en el informe.

## 2. Antes de desplegar a staging (release-manager)

- [ ] QA, código y seguridad APROBADOS (`docs/reviews/<slug>-*.md`).
- [ ] Rama al día con `main` (sin conflictos), commits limpios, sin archivos generados ni secretos.
- [ ] Migraciones: presentes, reversibles, probadas contra una copia de datos; clasificadas como seguras en línea o con ventana (ver `stack-db`).
- [ ] Variables de entorno nuevas documentadas en `staging/.env.staging` y en el informe (nombre y propósito; nunca el valor de producción).
- [ ] Dependencias nuevas con versión fijada y auditadas.
- [ ] `node kit.js staging --feature <slug>` termina en verde; `node kit.js smoke` pasa.
- [ ] Logs de staging sin errores ni advertencias nuevas en los primeros minutos.

## 3. Smoke tests: qué comprobar

Mínimo: salud del servicio, versión desplegada correcta, un flujo principal de punta a punta (login o equivalente), la funcionalidad de la feature con datos reales de staging, y que lo que no debía cambiar sigue igual (una petición de regresión por módulo tocado). Añade las URLs o pasos específicos en `scripts/smoke.js` (sección *PRUEBAS DEL PROYECTO*) o en `AGENTS.md`.

## 4. Informe de release (`docs/reviews/<slug>-release.md`)

1. Qué se despliega: rama, commit, migraciones incluidas, flags nuevos y su estado inicial.
2. Resultado de staging y smoke tests (con fecha/hora).
3. **Lista de comprobación manual** para la persona que aprueba: 3–6 pasos concretos en la URL de staging.
4. **Criterios de rollback:** qué señal (errores 5xx > X %, latencia > Y, fallo del smoke test, alerta concreta) y en qué ventana de observación (p. ej. 30 min).
5. **Procedimiento de rollback:** comando exacto (revertir despliegue, apagar flag, restaurar migración) y qué NO se puede revertir (datos ya escritos).
6. Riesgos residuales y a quién avisar.

## 5. Antes de producción (persona que ejecuta `node kit.js prod`)

- [ ] Leí el informe de release y ejecuté la lista de comprobación manual en staging.
- [ ] Sé cuál es el criterio y el comando de rollback.
- [ ] Es un momento adecuado (no viernes tarde, no antes de una ventana sin nadie observando).
- [ ] Tengo cómo observar los primeros minutos (logs, panel, alertas).
- [ ] Copia de seguridad reciente si hay migración.

Tras promover: observar la ventana definida, ejecutar el smoke test contra producción si existe, y anotar en el informe la hora y el resultado.

## 5b. Backends en Supabase
Staging = proyecto Supabase separado; despliegue solo con la CLI desde el repositorio (`node kit.js staging` hace `db push` + `functions deploy`). Nunca aplicar SQL en el SQL Editor ni desplegar funciones desde el panel o automatizando el navegador: no queda en git ni es repetible. Ajustes de Auth/Storage/secretos que la CLI no cubra van a la lista de comprobación manual del informe. Ver `docs/10-supabase.md` del kit.

## 6. Prohibido

- Desplegar a producción con cualquier revisión RECHAZADA o PENDIENTE (el script lo bloquea; no se salta).
- `--force`, `db push` o cambios manuales en producción para "arreglar rápido".
- Migraciones destructivas y código dependiente en el mismo release.
- Desplegar sin plan de rollback escrito.
- Desplegar por navegador (SQL Editor, panel, automatización de Chrome) cuando existe CLI.
- Improvisar una infraestructura de staging distinta de `STAGING_PROVIDER`; si no encaja, reportar `STAGING: FALLÓ — CONFIGURACION`.

## 7. Complementos externos (si están instalados)

`engineering:deploy-checklist` (Anthropic) para listas más detalladas por tipo de cambio; `engineering:incident-response` si algo sale mal tras desplegar; `superpowers` → `verification-before-completion` como hábito general antes de dar algo por terminado.
