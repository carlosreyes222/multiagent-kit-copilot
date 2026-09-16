---
name: deploy-staging
description: "Despliega la rama actual a staging con el proveedor de pipeline.config.ps1 y corre los smoke tests."
agent: director
argument-hint: "[slug]"
---
Ejecuta el comando `deploy-staging` del kit para la feature: ${input:slug:Slug de la feature (vacío = rama actual)}

Sigue la skill `.github/skills/deploy-staging/SKILL.md`.
