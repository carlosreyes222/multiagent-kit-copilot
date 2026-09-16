---
name: pipeline
description: "Flujo multiagente completo de una feature: spec → arquitectura → código → QA → revisiones → staging → arquitectura viva, con compuertas."
agent: director
argument-hint: "descripción de la idea, o 'continuar <slug>'"
---
Ejecuta el comando `pipeline` del kit con esta petición: ${input:idea:Describe la idea o feature (o "continuar <slug>")}

Sigue la skill `.github/skills/pipeline/SKILL.md` paso a paso. Detente en cada compuerta humana (aprobar spec, elegir stack) y espera mi respuesta.
