---
name: promote-prod
description: Muestra el estado de las compuertas (staging, smoke tests, seguridad) y explica cómo promover a producción. NO despliega — eso lo hace una persona.
disable-model-invocation: true
allowed-tools: ["read", "search", "execute"]
---

Lee `.pipeline/state.json` y `docs/reviews/<feature>-seguridad.md` y presenta una tabla con el estado de cada compuerta:

| Compuerta | Estado |
|---|---|
| Staging desplegado | ✔ / ✘ |
| Smoke tests | ✔ / ✘ |
| Seguridad | APROBADO / RECHAZADO / PENDIENTE |

Si todas están en verde, indica al usuario que ejecute en su terminal:

```bash
node kit.js prod
```

y que el script le pedirá escribir `PRODUCCION` para confirmar. Si alguna está en rojo, indica qué comando o agente la resuelve. Nunca ejecutes `node kit.js prod` desde aquí.
