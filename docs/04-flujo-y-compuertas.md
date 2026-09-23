# 4. El flujo, los agentes y las compuertas

## 4.1 El flujo de `/pipeline`

```
 idea ──► product-owner ──► arquitecto ──► implementador ──► tester
                │  (spec)       (ADR)   (feature/TICKET-… desde   │
                │                          la rama base)    ▲     │ QA
          COMPUERTA HUMANA                                  │     ▼
          (apruebas la spec,                                │   ┌─── revisor-codigo ───┐
           dices la rama base)                              └───┤                      ├──► release-manager ──► PULL REQUEST
                                                      correcciones   revisor-seguridad ─┘   (kit pr: push + gh)      │
                                                                     (VEREDICTO: APROBADO)                          ▼
                                                                                          arquitecto (MODO: DOCUMENTAR) actualiza docs/ARQUITECTURA.md
                                                                                                                     │
                                                                                     EL EQUIPO: revisión del PR, merge, tren de release
```

| Etapa | Agente | Produce | Compuerta |
|---|---|---|---|
| 1 Ideación | `product-owner` | `docs/specs/<slug>.md` | **Humana**: apruebas la spec |
| 2 Arquitectura | `arquitecto` | `docs/adr/<slug>.md` (y `0000-stack.md` en proyecto vacío) | **Humana** en proyecto vacío: eliges el stack |
| 3 Implementación | `implementador` | rama `feature/TICKET-<slug>` desde la rama base (ver §4.5) | Hook `commit-gate`: lint + tests en cada commit |
| 4 QA | `tester` | `docs/reviews/<slug>-qa.md` | `QA: APROBADO` o vuelve a 3 (máx. 2 veces) |
| 5 Revisiones (paralelo) | `revisor-codigo`, `revisor-seguridad` | `<slug>-codigo.md`, `<slug>-seguridad.md` | Ambos APROBADOS o vuelve a 3 |
| 6 Pull request | `release-manager` | `<slug>-pr.md`, rama subida, PR abierto (`kit pr`) | Compuertas aprobadas y commiteadas; sin `gh` o sin permisos: rama subida o local con el motivo |
| 7 Documentación | `arquitecto` | `docs/ARQUITECTURA.md` actualizado | Obligatoria |
| 8 Entrega | `director` (orquestador) | resumen + estado del PR | **Equipo**: revisión, merge y release fuera del kit |

## 4.1b Los otros tres flujos

`/pipeline` es el flujo largo para features. Hay tres flujos más que reutilizan los mismos agentes:

- **`/analisis`** — arquitecto, revisor de código y revisor de seguridad leen en paralelo el alcance indicado y el coordinador consolida `docs/analisis/<fecha>-<slug>.md` con respuesta directa, hallazgos P1/P2/P3 y el comando del kit para cada acción. Sin compuertas humanas porque no cambia nada.
- **`/bugfix`** — tester (reproducir + prueba roja, compuerta: si no reproduce, se detiene) → implementador (corrección mínima en `fix/*`) → tester (regresión) → revisores en paralelo → release-manager (pull request con smoke del escenario del bug) → entrada en `docs/RETRO.md` con la causa raíz. `--urgente` reduce compuertas solo con confirmación explícita y lo deja registrado.
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
| `release-manager` | Comprueba compuertas, sube la rama y abre el PR (`kit pr`); nunca fusiona ni despliega | no |
| `investigador` | Benchmark externo (web, repos, tiendas, reseñas) de productos similares; propone funcionalidades adaptadas con fuente | no |

Cada agente lee al empezar su skill de método (`metodo-spec`, `metodo-adr`, `metodo-code-review`, `metodo-qa`, `metodo-deploy`), que fija procedimiento, severidades y formato de los informes; y las skills de stack que `AGENTS.md` liste. Los agentes viven en el plugin (`plugins/multiagent-kit/com.github.copilot/agents/`) y `kit init` los copia a `.github/agents/` del proyecto. No fijan modelo: heredan el de la sesión (puedes añadir `model:` en el frontmatter, p. ej. `claude-sonnet-4.6` o `gpt-5.4`, y publicar una versión nueva). Ver [08-superficies-copilot.md](08-superficies-copilot.md) para cómo se delegan en cada superficie.

## 4.3 Las compuertas, en detalle

1. **Humana, tras la spec.** Nada se construye sin que apruebes qué se va a construir.
2. **Humana, al elegir stack** (solo proyecto vacío). Es la decisión más cara de deshacer.
3. **Commit.** El hook `commit-gate` (`.github/hooks/kit.json` → `kit hook commit-gate`) ejecuta `LINT_CMD` y `TEST_CMD` antes de cada `git commit`; si fallan, el commit se bloquea y el agente recibe el error para corregirlo. Se desactiva con `GATE_TESTS_ON_COMMIT = false` en `pipeline.config.json`.
4. **Ramas protegidas y secretos.** El hook `protect-main` bloquea comandos destructivos (`git push --force`, `git reset --hard`, `rm -rf`…), la lectura o edición de `.env*`, keystores y `google-services.json`, y bloquea `git commit` y `git push` en `main`/`master`/`develop`/`release` (lista en `PROTECTED_BRANCHES`; añade las ramas de release del equipo) y bloquea `git merge` a ellas si `docs/reviews/<slug>-seguridad.md` no dice `VEREDICTO: APROBADO`.
5. **Revisiones.** QA, código y seguridad deben estar APROBADOS y commiteados para que el release-manager abra el PR (`kit pr` lo vuelve a comprobar).
6. **Pull request.** `kit pr` sube la rama y abre el PR contra la rama base acordada; nunca fusiona. El merge, el tren de release y el despliegue son del equipo, con las reglas del repositorio en GitHub como barrera final.

Los hooks solo actúan en proyectos que tienen `pipeline.config.json`; en tus otros proyectos no interfieren. En el cloud agent corren igual (Node viene preinstalado en Ubuntu); además, protege `main` con un ruleset del repositorio, que es la barrera que ningún agente puede saltar (ver [09](09-cloud-agent-y-github.md)).

El estado del pipeline (`.pipeline/state.json`, esquema v2) lo escriben solo los scripts: los agentes usan `kit state clave=valor` y tú lo consultas con `kit status`.

## 4.4 La rama base y el pull request

Al iniciar cada `/pipeline` o `/bugfix` el orquestador te pregunta contra qué rama irá el PR (`develop`, `release_xx`, `main`…) y la guarda en el estado (`pr_base`). La rama `feature/*` se crea desde esa base actualizada. Al cerrar, `kit pr --feature <slug> --base <rama>` comprueba que QA, código (salvo modo rápido) y seguridad están aprobados y commiteados y la rama limpia; escribe `docs/reviews/<slug>-pr.md` (título `<tipo>: TICKET …`, documentos enlazados, commits, cómo probar); hace `git push -u origin <rama>` y abre el PR con `gh pr create`. Resultado en la última línea: `PR: CREADO <url>`; `PR: RAMA SUBIDA (motivo)` si `gh` no está o falló (abres el PR con la descripción); `PR: RAMA LOCAL (motivo)` si el push no fue posible (sin remoto, permisos, rama remota con commits nuevos). Nunca `--force`, nunca cambio de base, nunca merge.

## 4.5 Nomenclatura de ramas y commits

| Situación | Rama | Commits | Base del PR |
|---|---|---|---|
| Feature sin ticket | `feature/<slug>` (ej. `feature/login-biometrico`) | libres, pequeños y descriptivos | la acordada al iniciar (`develop`, `release_xx`…) |
| Feature con ticket de Jira | `feature/<TICKET>-<slug>` (ej. `feature/BMOSHELL-123-login-biometrico`) | `<tipo>: <TICKET> descripción` (ej. `feat: BMOSHELL-123 añade refreshToken`) | la acordada |
| Bugfix | `fix/<slug>` o `fix/<TICKET>-<slug>` | `fix: <TICKET> descripción` | igual |
| Feature en un SDK (`--sdk`) | la misma rama en el SDK y en el padre | igual en los dos repos | igual |

El ticket se detecta solo: basta escribirlo en la idea (`/pipeline bmoshell-123 login biométrico`), en cualquier posición y en minúsculas; el orquestador lo pasa a MAYÚSCULAS, lo quita del texto y lo registra con `kit state ticket=BMOSHELL-123`. A partir de ahí el hook `protect-main` **bloquea** a los agentes cualquier rama `feature/*` o `fix/*` sin el ticket y cualquier `git commit -m` que no empiece por `<tipo>: <TICKET>` (tipos: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `style`, `revert`; también con scope, `feat(auth): …`). `kit state reset` al cerrar la feature lo limpia. Los documentos (`docs/specs`, `docs/adr`, `docs/reviews`) usan el mismo slug con ticket, así que todo lo de una feature se encuentra buscando `BMOSHELL-123`.

## 4.6 Tamaño de la feature y modo rápido

Cada spec termina con `TAMAÑO: S|M|L`. Si es S (un módulo, sin cambios de datos, API pública, autenticación ni pagos, < ~150 líneas) el orquestador te propone el **modo rápido** en la compuerta de la spec (o lo pides tú con `/pipeline --rapido "idea"`): sin ADR (el arquitecto deja una nota técnica de ≤ 15 líneas en la spec) y sin revisor de código; QA, revisor de seguridad, PR y arquitectura viva se mantienen. Queda registrado como `compuertas=reducidas` en el estado y en la entrega; si QA rechaza o seguridad detecta cambios de API, datos o autenticación, se escala al pipeline completo. No se combina con `--sdk`.

## 4.7 Épicas: una idea partida en varias HU

Cuando la idea no cabe en una feature (spec > 120 líneas, más de un par de días), el product-owner no escribe una spec: propone una **épica** con 3–10 historias de usuario independientes, en orden de dependencia, y la registra en `docs/epicas/<nombre>.md` (tabla `# · HU · Slug · Ticket · Estado · Depende de · Notas`). Tú apruebas la partición (compuerta humana) y el pipeline arranca con la primera HU; al terminar cada una te pregunta si sigues con la siguiente. También puedes forzarlo: `/pipeline --epica "idea grande"`.

El archivo lo mantiene el kit, no los agentes: `kit epica status <nombre>` recalcula el estado de cada HU **desde lo que hay en disco** (spec, ADR, rama `feature/*`, informes de QA/código/seguridad/release, si la rama está fusionada en main y el estado vivo del pipeline) y te dice la siguiente HU y el comando exacto para retomarla. `kit status` lo muestra también. Para retomar tras días: `/pipeline continuar <nombre-de-epica>`. Estados que solo se fijan a mano: `bloqueada` y `descartada` (`kit epica set <nombre> <slug> estado=bloqueada notas="…"`).

---
Anterior: [03-usar-en-un-proyecto.md](03-usar-en-un-proyecto.md) · Siguiente: [05-arquitectura-viva.md](05-arquitectura-viva.md) · [Índice](../README.md)
