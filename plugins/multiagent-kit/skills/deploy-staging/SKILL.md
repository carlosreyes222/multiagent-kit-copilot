---
name: deploy-staging
description: Despliega la rama actual al ambiente de pruebas (proveedor de `pipeline.config.json`) y corre los smoke tests, sin pasar por todo el pipeline. Uso — /deploy-staging [slug]
disable-model-invocation: true
allowed-tools: ["read", "search", "execute"]
---

Despliega a staging la feature cuyo slug acompaña a la invocación (si no se indica, usa el nombre de la rama actual sin el prefijo `feature/`).

1. Ejecuta: `node kit.js staging --feature <slug>`
2. Si termina bien, ejecuta: `node kit.js smoke`
3. Si algo falla, muestra las últimas 50 líneas de `docker compose -f staging/docker-compose.staging.yml logs` y explica la causa probable. No modifiques código.
4. Reporta la URL de staging y el estado de los smoke tests.
