---
applyTo: "**"
description: "Reglas del kit multiagente (compuertas, ramas, secretos, estado) para cualquier archivo del repositorio."
---
# Reglas del kit multiagente para Copilot

- Antes de tocar código lee `AGENTS.md` y `docs/ARQUITECTURA.md` (si existe). No explores todo el repositorio: ubica los módulos por el mapa de arquitectura.
- Todo cambio va en una rama `feature/<slug>` o `fix/<slug>`. Está prohibido `git commit`, `git push` o `git merge` sobre `main`/`master`; el hook del kit (perfil de usuario) lo bloquea.
- Antes de cada commit deben pasar `LINT_CMD` y `TEST_CMD` de `pipeline.config.json` (compuerta de commit).
- Los informes de QA, código, seguridad y PR viven en `docs/reviews/<slug>-{qa,codigo,seguridad,pr}.md` y terminan con una línea de veredicto exacta (`QA:`, `CODIGO:`, `VEREDICTO:`, `PR:`). Respeta los límites de líneas de `pipeline.config.json`.
- El estado del pipeline se cambia solo con `kit state clave=valor`; nunca se edita `.pipeline/state.json`.
- Entrega: el flujo termina en el pull request (`kit pr`, lo ejecuta el release-manager). Nunca hagas merge ni despliegues; ramas `feature/*` y `fix/*` desde la rama base acordada, con ticket en mayúsculas y commits `<tipo>: TICKET descripción`.
- Secretos: no leas ni edites `.env*` (salvo `.env.example`), `*.jks`, `*.keystore`, `*.p12`, `*.pem` ni `google-services.json`.
- Comandos destructivos prohibidos: `git push --force`, `git reset --hard`, `rm -rf`, `git rebase` sobre ramas compartidas.
- Sistema operativo: los comandos del kit (`kit …`) son iguales en Windows y macOS; para el resto detecta Windows o macOS/Linux antes de ejecutar (`.\gradlew` / `./gradlew`, `winget` / `brew`). No supongas Windows.
