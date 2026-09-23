# Instrucciones para GitHub Copilot en este repositorio

Lee y respeta `AGENTS.md` (contexto, convenciones y comandos del proyecto) y, si existe, `docs/ARQUITECTURA.md` antes de explorar código.

Este repositorio (React Native bare, sin Expo) usa el kit multiagente `multiagent-kit` para Copilot:
- Los flujos (`/pipeline`, `/analisis`, `/bugfix`, `/ideas`, `/retro-kit`) los ejecuta el agente `director` delegando en los agentes del kit.
- Compuertas obligatorias: spec aprobada por una persona, `QA: APROBADO`, `CODIGO: APROBADO`, `VEREDICTO: APROBADO` de seguridad. El flujo termina en un **pull request** contra la rama base acordada (`kit pr`); el merge y el release los hace el equipo.
- Nunca hagas commit, push ni merge sobre `main`, `develop` ni ramas de release; trabaja en `feature/*` o `fix/*` con el ticket en mayúsculas y commits `<tipo>: TICKET descripción`.
- No leas ni edites `.env*`, keystores ni `google-services.json`; los secretos viajan por variables de entorno.
- Los comandos de build/test/lint están en `pipeline.config.json`; úsalos a través de `kit …`.
- Los archivos que copia el kit en `.github/` (modo repo) los gestiona `kit update`; no los edites a mano, crea otros al lado.
