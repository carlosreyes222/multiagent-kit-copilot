---
applyTo: "**"
description: "Reglas del kit multiagente (compuertas, ramas, secretos, estado) para cualquier archivo del repositorio."
---
# Reglas del kit multiagente para Copilot

- Antes de tocar código lee `AGENTS.md` y `docs/ARQUITECTURA.md` (si existe). No explores todo el repositorio: ubica los módulos por el mapa de arquitectura.
- Todo cambio va en una rama `feature/<slug>` o `fix/<slug>`. Está prohibido `git commit`, `git push` o `git merge` sobre `main`/`master`; el hook `.github/hooks/kit.json` lo bloquea.
- Antes de cada commit deben pasar `LINT_CMD` y `TEST_CMD` de `pipeline.config.ps1` (compuerta de commit).
- Los informes de QA, código, seguridad y release viven en `docs/reviews/<slug>-{qa,codigo,seguridad,release}.md` y terminan con una línea de veredicto exacta (`QA:`, `CODIGO:`, `VEREDICTO:`, `STAGING:`). Respeta los límites de líneas de `pipeline.config.ps1`.
- El estado del pipeline se cambia solo con `pwsh -NoProfile -File kit.ps1 state clave=valor`; nunca se edita `.pipeline/state.json`.
- Producción: nunca ejecutes `kit.ps1 prod`, `promote-prod.ps1`, `supabase db push` ni `supabase functions deploy`. Solo una persona promueve.
- Secretos: no leas ni edites `.env*` (salvo `.env.example`), `*.jks`, `*.keystore`, `*.p12`, `*.pem` ni `google-services.json`.
- Comandos destructivos prohibidos: `git push --force`, `git reset --hard`, `rm -rf`, `docker system prune`, `docker volume rm`, `docker compose down -v`.
