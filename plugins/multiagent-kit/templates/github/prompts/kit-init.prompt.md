---
name: kit-init
description: "Inicializa o actualiza este proyecto para el kit multiagente (pipeline.config.json, AGENTS.md, kit.js, .github/)."
agent: director
argument-hint: "repo | local | usuario"
---
Modo elegido: ${input:modo:repo (versionado), local (solo este clon) o usuario (perfil, nada en el repo)}

Ejecuta el comando `kit-init` del kit siguiendo la skill `kit-init` (en `.github/skills/` del proyecto o en `~/.copilot/skills/`). Si `kit.js` ya existe, usa `node kit.js update`.
