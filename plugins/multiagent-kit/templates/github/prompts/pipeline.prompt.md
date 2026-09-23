---
name: pipeline
description: "Flujo multiagente completo de una feature: spec → arquitectura → código → QA → revisiones → pull request → arquitectura viva, con compuertas."
agent: director
argument-hint: "descripción de la idea, 'continuar <slug>', '--rapido idea', '--epica idea grande', 'continuar <epica>' o '--sdk <nombre> idea'"
---
Ejecuta el comando `pipeline` del kit con esta petición: ${input:idea:Describe la idea o feature (o "continuar <slug>", o "--sdk <nombre> idea" para una feature que nace en un SDK del equipo)}

Sigue la skill `pipeline` (en `~/.copilot/skills/`) paso a paso. Detente en cada compuerta humana (aprobar spec, elegir stack) y espera mi respuesta.
