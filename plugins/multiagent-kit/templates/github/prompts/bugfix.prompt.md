---
name: bugfix
description: "Reproducir un bug con una prueba roja, corregirlo en fix/*, validar con QA y revisiones, y desplegar a staging. Modificadores --solo-diagnostico y --urgente."
agent: director
argument-hint: "descripción o traza del bug [--solo-diagnostico | --urgente]"
---
Ejecuta el comando `bugfix` del kit con esta petición: ${input:bug:Descripción del bug o traza (añade --solo-diagnostico o --urgente si aplica)}

Sigue la skill `bugfix` (en `.github/skills/` del proyecto o en `~/.copilot/skills/`). Con `--urgente`, confírmame qué compuertas se reducen antes de continuar.
