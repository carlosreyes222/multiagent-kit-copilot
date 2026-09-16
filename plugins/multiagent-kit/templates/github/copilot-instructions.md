# Instrucciones para GitHub Copilot en este repositorio

Lee y respeta `AGENTS.md` (contexto, convenciones y comandos del proyecto) y, si existe, `docs/ARQUITECTURA.md` antes de explorar código.

Este repositorio usa el kit multiagente `multiagent-kit` para Copilot:
- Los flujos (`/pipeline`, `/analisis`, `/bugfix`, `/ideas`) están en `.github/skills/` y los ejecuta el agente `director` delegando en los agentes de `.github/agents/`.
- Las compuertas de calidad son obligatorias: spec aprobada por una persona, `QA: APROBADO`, `CODIGO: APROBADO`, `VEREDICTO: APROBADO` de seguridad y `STAGING: LISTO` antes de proponer producción. La promoción a producción (`kit.ps1 prod`) solo la ejecuta una persona.
- Nunca hagas commit, push ni merge sobre `main`/`master`; trabaja en `feature/*` o `fix/*` y abre un pull request.
- No leas ni edites `.env*`, keystores ni `google-services.json`; los secretos viajan por variables de entorno.
- Los comandos de build/test/lint y el proveedor de staging están en `pipeline.config.ps1`; úsalos a través de `pwsh -NoProfile -File kit.ps1 …`.
- Los archivos de `.github/agents`, `.github/skills`, `.github/prompts`, `.github/hooks/kit.json` y `kit.ps1` los gestiona el kit (`kit.ps1 update`); no los edites a mano, crea otros al lado.
