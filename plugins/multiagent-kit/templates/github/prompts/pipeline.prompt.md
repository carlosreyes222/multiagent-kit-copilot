---
name: pipeline
description: "Flujo multiagente completo de una feature: spec → arquitectura → código → QA → revisiones → staging → arquitectura viva, con compuertas."
agent: director
argument-hint: "descripción de la idea, 'continuar <slug>' o '--sdk <nombre> idea'"
---
Ejecuta el comando `pipeline` del kit con esta petición: ${input:idea:Describe la idea o feature (o "continuar <slug>", o "--sdk <nombre> idea" para una feature que nace en un SDK del equipo)}

Sigue la skill `pipeline` (en `.github/skills/` del proyecto o en `~/.copilot/skills/`) paso a paso. Detente en cada compuerta humana (aprobar spec, elegir stack) y espera mi respuesta.
