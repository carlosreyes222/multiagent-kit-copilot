# 9. GitHub: reglas del repositorio y pull request

El kit termina en el pull request; lo que pasa después lo garantiza GitHub, no los agentes. Esta guía resume lo mínimo que conviene tener configurado en el repositorio del trabajo.

## 9.1 Reglas del repositorio (rulesets)

Protege `develop`, `main` y las ramas `release_*` con un ruleset: pull request obligatorio, al menos una revisión, checks de CI en verde, sin push directo y sin force-push. Es la barrera que ningún agente (ni el kit, ni el hook local) puede saltar, y la razón por la que el kit nunca fusiona: `kit pr` abre el PR y ahí termina.

## 9.2 El PR que abre el kit

`kit pr` sube la rama `feature/TICKET-…` y abre el PR contra la base que indicaste al empezar, con título `<tipo>: TICKET <título de la spec>` y una descripción que resume spec (criterios de aceptación), ADR (decisión) e informes de QA, código y seguridad (veredicto y commit revisado), lista los commits y explica cómo probar. Spec, ADR e informes no están en el repo (solo `docs/ARQUITECTURA.md`): por eso el PR lleva el resumen y no enlaces. La descripción queda también en `docs/reviews/<slug>-pr.md`, local. Si el repositorio tiene plantilla de PR, `gh` la respeta y el cuerpo del kit se añade; si tiene CODEOWNERS, las revisiones se asignan solas.

## 9.3 Cuando la revisión pide cambios

`/pipeline continuar <slug>` desde la Etapa 3 (si ya cerraste la feature, antes `kit state restaurar <slug>`): el implementador añade commits a la misma rama (misma nomenclatura), pasan de nuevo QA y revisiones y el PR se actualiza solo. No se abre otro PR.

## 9.4 Cloud agent de github.com

No aplica a este kit: solo lee agentes que vivan en el repositorio, y aquí no queda nada del kit en el repo. Si el equipo quisiera usarlo, sería un kit aparte con los agentes versionados.

## 9.5 Tren de release

El merge del PR a `develop` (o a `release_xx`) y todo lo posterior es del proceso del equipo. El kit no participa: no etiqueta, no despliega, no toca ramas de release.

---
Anterior: [08-superficies-copilot.md](08-superficies-copilot.md) · Siguiente: [10-skills-y-plugins-externos.md](10-skills-y-plugins-externos.md) · [Índice](../README.md)
