---
applyTo: "**"
description: "Reglas del kit multiagente (compuertas, ramas, secretos, estado) para cualquier archivo del repositorio."
---
# Reglas del kit multiagente para Copilot

- Antes de tocar código lee `AGENTS.md` y `docs/ARQUITECTURA.md` (si existe). No explores todo el repositorio: ubica los módulos por el mapa de arquitectura.
- Todo cambio va en una rama `feature/<slug>` o `fix/<slug>`. Está prohibido `git commit`, `git push` o `git merge` sobre `main`/`master`; el hook `.github/hooks/kit.json` lo bloquea.
- Antes de cada commit deben pasar `LINT_CMD` y `TEST_CMD` de `pipeline.config.json` (compuerta de commit).
- Los informes de QA, código, seguridad y release viven en `docs/reviews/<slug>-{qa,codigo,seguridad,release}.md` y terminan con una línea de veredicto exacta (`QA:`, `CODIGO:`, `VEREDICTO:`, `STAGING:`). Respeta los límites de líneas de `pipeline.config.json`.
- El estado del pipeline se cambia solo con `node kit.js state clave=valor`; nunca se edita `.pipeline/state.json`.
- Producción: nunca ejecutes `node kit.js prod`, `scripts/prod.js`, `supabase db push` ni `supabase functions deploy`. Solo una persona promueve.
- Secretos: no leas ni edites `.env*` (salvo `.env.example`), `*.jks`, `*.keystore`, `*.p12`, `*.pem` ni `google-services.json`.
- Comandos destructivos prohibidos: `git push --force`, `git reset --hard`, `rm -rf`, `docker system prune`, `docker volume rm`, `docker compose down -v`.
- Sistema operativo: los comandos del kit (`node kit.js …`) son iguales en todos los sistemas; para el resto detecta Windows o macOS/Linux antes de ejecutar (`.\gradlew` / `./gradlew`, `winget` / `brew`). No supongas Windows.
