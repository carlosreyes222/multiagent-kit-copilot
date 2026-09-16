# 4. El flujo, los agentes y las compuertas

## 4.1 El flujo de `/pipeline`

```
 idea ──► product-owner ──► arquitecto ──► implementador ──► tester
                │  (spec)       (ADR)        (rama feature/*)    │
                │                                  ▲            │ QA
          COMPUERTA HUMANA                         │            ▼
          (apruebas la spec)                       │   ┌─── revisor-codigo ───┐
                                                   └───┤                      ├──► release-manager ──► STAGING (Docker)
                                             correcciones   revisor-seguridad ─┘          │
                                                            (VEREDICTO: APROBADO)         ▼
                                                                                   smoke tests
                                                                                          │
                                                                              arquitecto (MODO: DOCUMENTAR)
                                                                              actualiza docs/ARQUITECTURA.md
                                                                                          │
                                                                              TÚ: .\kit.ps1 prod
                                                                                          │
                                                                                     PRODUCCIÓN
```

| Etapa | Agente | Produce | Compuerta |
|---|---|---|---|
| 1 Ideación | `product-owner` | `docs/specs/<slug>.md` | **Humana**: apruebas la spec |
| 2 Arquitectura | `arquitecto` | `docs/adr/<slug>.md` (y `0000-stack.md` en proyecto vacío) | **Humana** en proyecto vacío: eliges el stack |
| 3 Implementación | `implementador` | rama `feature/<slug>` | Hook `commit-gate`: lint + tests en cada commit |
| 4 QA | `tester` | `docs/reviews/<slug>-qa.md` | `QA: APROBADO` o vuelve a 3 (máx. 2 veces) |
| 5 Revisiones (paralelo) | `revisor-codigo`, `revisor-seguridad` | `<slug>-codigo.md`, `<slug>-seguridad.md` | Ambos APROBADOS o vuelve a 3 |
| 6 Staging | `release-manager` | `<slug>-release.md`, contenedor Docker | Smoke tests |
| 7 Documentación | `arquitecto` | `docs/ARQUITECTURA.md` actualizado | Obligatoria |
| 8 Entrega | `director` (orquestador) | resumen + URL de staging | **Humana**: `.\kit.ps1 prod` |

## 4.1b Los otros tres flujos

`/pipeline` es el flujo largo para features. Hay tres flujos más que reutilizan los mismos agentes:

- **`/analisis`** — arquitecto, revisor de código y revisor de seguridad leen en paralelo el alcance indicado y el coordinador consolida `docs/analisis/<fecha>-<slug>.md` con respuesta directa, hallazgos P1/P2/P3 y el comando del kit para cada acción. Sin compuertas humanas porque no cambia nada.
- **`/bugfix`** — tester (reproducir + prueba roja, compuerta: si no reproduce, se detiene) → implementador (corrección mínima en `fix/*`) → tester (regresión) → revisores en paralelo → release-manager (staging con smoke del escenario del bug) → entrada en `docs/RETRO.md` con la causa raíz. `--urgente` reduce compuertas solo con confirmación explícita y lo deja registrado.
- **`/ideas`** — product-owner, investigador (benchmark web de productos similares), arquitecto y ambos revisores proponen ideas con evidencia; la consolidación garantiza al menos la mitad de producto/mercado; el coordinador consolida una tabla priorizada (impacto/esfuerzo/dependencias), tres recomendaciones y el comando para lanzar cada idea.

## 4.2 Los agentes

| Agente | Rol | Puede editar código |
|---|---|---|
| `director` | Orquestador: recibe el comando, lee la skill correspondiente y delega cada etapa; aplica las compuertas | no |
| `product-owner` | Idea → spec con criterios de aceptación verificables | no |
| `arquitecto` | Spec → ADR; propone stack en proyectos vacíos; mantiene `ARQUITECTURA.md` | no |
| `implementador` | Implementa en una rama `feature/*`; hace el bootstrap en proyectos vacíos | sí |
| `tester` | Escribe y corre pruebas por cada criterio de aceptación, reporta bugs | solo pruebas |
| `revisor-codigo` | Calidad, corrección, mantenibilidad (solo lectura) | no |
| `revisor-seguridad` | Secretos, inyección, autenticación, dependencias, OWASP (solo lectura) | no |
| `release-manager` | Despliega a staging, smoke tests, prepara la entrega; nunca a producción | no |
| `investigador` | Benchmark externo (web, repos, tiendas, reseñas) de productos similares; propone funcionalidades adaptadas con fuente | no |

Cada agente lee al empezar su skill de método (`metodo-spec`, `metodo-adr`, `metodo-code-review`, `metodo-qa`, `metodo-deploy`), que fija procedimiento, severidades y formato de los informes; y las skills de stack que `AGENTS.md` liste. Los agentes viven en el plugin (`plugins/multiagent-kit/com.github.copilot/agents/`) y `kit.ps1 init` los copia a `.github/agents/` del proyecto. No fijan modelo: heredan el de la sesión (puedes añadir `model:` en el frontmatter, p. ej. `claude-sonnet-4.6` o `gpt-5.4`, y publicar una versión nueva). Ver [08-superficies-copilot.md](08-superficies-copilot.md) para cómo se delegan en cada superficie.

## 4.3 Las compuertas, en detalle

1. **Humana, tras la spec.** Nada se construye sin que apruebes qué se va a construir.
2. **Humana, al elegir stack** (solo proyecto vacío). Es la decisión más cara de deshacer.
3. **Commit.** El hook `commit-gate` (`.github/hooks/kit.json` → `kit.ps1 hook commit-gate`) ejecuta `LINT_CMD` y `TEST_CMD` antes de cada `git commit`; si fallan, el commit se bloquea y el agente recibe el error para corregirlo. Se desactiva con `$GATE_TESTS_ON_COMMIT = $false` en `pipeline.config.ps1`.
4. **Ramas protegidas y secretos.** El hook `protect-main` bloquea comandos destructivos (`git push --force`, `git reset --hard`, `rm -rf`, `docker volume rm`…), la lectura o edición de `.env*`, keystores y `google-services.json`, y bloquea `git commit` y `git push` en `main`/`master`/`produccion`/`release` (lista en `$PROTECTED_BRANCHES`) y bloquea `git merge` a ellas si `docs/reviews/<slug>-seguridad.md` no dice `VEREDICTO: APROBADO`.
5. **Revisiones.** QA, código y seguridad deben estar APROBADOS para que el release-manager despliegue a staging.
6. **Producción.** `.\kit.ps1 prod` exige staging OK + smoke tests OK + seguridad APROBADO (lee `.pipeline/state.json` y el informe de seguridad) y que escribas `PRODUCCION`. El hook `protect-main` deniega `kit.ps1 prod`, `promote-prod.ps1` y `supabase db push/functions deploy` a cualquier agente, y `.github/instructions/kit.instructions.md` se lo recuerda en cada sesión.

Los hooks solo actúan en proyectos que tienen `pipeline.config.ps1`; en tus otros proyectos no interfieren. En el cloud agent corren igual (`bash` → `pwsh`, preinstalado en Ubuntu); además, protege `main` con un ruleset del repositorio, que es la barrera que ningún agente puede saltar (ver [09](09-cloud-agent-y-github.md)).

El estado del pipeline (`.pipeline/state.json`, esquema v2) lo escriben solo los scripts: los agentes usan `kit.ps1 state clave=valor` y tú lo consultas con `kit.ps1 status`.

## 4.4 El ambiente de pruebas (staging)

El staging depende de `STAGING_PROVIDER` (ver [11-staging-por-proveedor.md](11-staging-por-proveedor.md)). Con `docker`, `.\kit.ps1 staging` compila, corre las pruebas, construye la imagen con `staging/Dockerfile.staging` y levanta `staging/docker-compose.staging.yml` en `http://localhost:<STAGING_PORT>`. Espera hasta 60 s a que `HEALTH_PATH` responda 200. `.\kit.ps1 smoke` comprueba salud y reinicios del contenedor; añade tus propias URLs en la sección *PRUEBAS DEL PROYECTO* de `smoke-test.ps1` (en el plugin) o en `AGENTS.md` para que el release-manager las pruebe.

Si tu proyecto ya tiene Dockerfile, apunta `build.dockerfile` del compose a él. Si necesitas base de datos en staging, descomenta el servicio `db` de ejemplo.

---
Anterior: [03-usar-en-un-proyecto.md](03-usar-en-un-proyecto.md) · Siguiente: [05-arquitectura-viva.md](05-arquitectura-viva.md) · [Índice](../README.md)
