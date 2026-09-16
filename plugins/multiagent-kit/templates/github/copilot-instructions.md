# Instrucciones para GitHub Copilot en este repositorio

Lee y respeta `AGENTS.md` (contexto, convenciones y comandos del proyecto) y, si existe, `docs/ARQUITECTURA.md` antes de explorar código.

Este repositorio usa el kit multiagente `multiagent-kit` para Copilot:
- Los flujos (`/pipeline`, `/analisis`, `/bugfix`, `/ideas`) están en `.github/skills/` y los ejecuta el agente `director` delegando en los agentes de `.github/agents/`.
- Las compuertas de calidad son obligatorias: spec aprobada por una persona, `QA: APROBADO`, `CODIGO: APROBADO`, `VEREDICTO: APROBADO` de seguridad y `STAGING: LISTO` antes de proponer producción. La promoción a producción (`node kit.js prod`) solo la ejecuta una persona.
- Nunca hagas commit, push ni merge sobre `main`/`master`; trabaja en `feature/*` o `fix/*` y abre un pull request.
- No leas ni edites `.env*`, keystores ni `google-services.json`; los secretos viajan por variables de entorno.
- Los comandos de build/test/lint y el proveedor de staging están en `pipeline.config.json`; úsalos a través de `node kit.js …`.
- Los archivos de `.github/agents`, `.github/skills`, `.github/prompts`, `.github/hooks/kit.json` y `kit.js` los gestiona el kit (`node kit.js update`); no los edites a mano, crea otros al lado.
