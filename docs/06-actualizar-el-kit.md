# 6. Actualizar el kit

## 6.1 Qué vive dónde

| En el plugin (fuente de verdad) | Copia gestionada en cada proyecto (`node kit.js update`) | Tuyo en cada proyecto (nunca se sobrescribe) |
|---|---|---|
| `com.github.copilot/agents/` — director + 8 agentes | `.github/agents/` | `pipeline.config.json` |
| `skills/` — comandos, `metodo-*`, `stack-*` | `.github/skills/` | `AGENTS.md`, `.github/copilot-instructions.md` |
| `templates/github/prompts/` | `.github/prompts/` | `.github/copilot/settings.json` |
| `templates/github/hooks/kit.json` | `.github/hooks/kit.json` | `.github/workflows/copilot-setup-steps.yml` |
| `templates/github/instructions/` | `.github/instructions/kit.instructions.md` | `staging/`, `docs/` |
| `templates/kit.js` | `kit.js` | `.gitignore`, `.dockerignore` (se fusionan) |
| `scripts/` — init/update, hooks, staging, smoke, prod, estado | (no se copian: `kit.js` los llama en el plugin) | |

A diferencia del kit de Claude Code, aquí **sí** hay copias en el proyecto, porque VS Code y el cloud agent solo leen lo que está en el repositorio. Por eso actualizar tiene dos pasos: el plugin (una vez por PC) y los archivos gestionados (una vez por proyecto, y se hace commit para todo el equipo).

## 6.2 Publicar una versión nueva (tú, en el repositorio del kit)

1. Haz los cambios en `plugins/multiagent-kit/`.
2. Sube la versión en **dos** sitios, con la misma cifra (p. ej. `1.1.0`):
   - `plugins/multiagent-kit/plugin.json` → `"version"`
   - `marketplace.json` (raíz del repositorio) → `"version"` de la entrada del plugin
3. Anota el cambio en `CHANGELOG.md` e indica si hace falta `node kit.js update` en los proyectos.
4. `git add . ; git commit -m "multiagent-kit 1.1.0" ; git push`

## 6.3 Recibir una versión nueva

En cada PC:

```powershell
copilot plugin marketplace update carlos-kits-copilot
copilot plugin update multiagent-kit@carlos-kits-copilot
```

o dentro de `copilot`: `/plugin` marca los plugins con versión nueva y ofrece **Update**. Para que se actualice solo al iniciar sesión, añade `"autoUpdate": true` a la entrada `carlos-kits-copilot` de `extraKnownMarketplaces` en `~/.copilot/settings.json` (solo se honra en la configuración de usuario, no en la del repositorio).

En cada proyecto:

```powershell
node kit.js update
git add .github kit.js ; git commit -m "kit: actualizar a 1.1.0"
```

`update` sobrescribe un archivo gestionado **solo si no lo has modificado** desde la última copia (lo comprueba con los hashes de `.github/kit-manifest.json`). Si lo tocaste, deja la versión nueva al lado como `.kit` y te lo dice. Al abrir `copilot`, el hook de inicio avisa cuando los archivos del proyecto son de una versión anterior al plugin; `node kit.js version` lo muestra también.

## 6.4 Personalizar sin perder las actualizaciones

- Para cambiar un agente o una skill **en un proyecto**, no edites el archivo gestionado: crea otro al lado (`.github/agents/arquitecto-mobile.agent.md`, `.github/skills/mi-metodo/SKILL.md`) y menciónalo en `AGENTS.md`. Si aun así editas uno gestionado, `update` lo respeta y te deja el `.kit`.
- Para cambiar algo **para todos los proyectos**, edítalo en el plugin y publica versión.

## 6.5 Probar un cambio antes de publicarlo

Registra el marketplace desde la carpeta local: los plugins con origen local se cargan en vivo y cada cambio se ve al reiniciar la sesión (`/restart`), sin `plugin update`:

```powershell
copilot plugin marketplace add C:\Users\carr9\Documents\multiagent-kit-copilot
copilot plugin install multiagent-kit@carlos-kits-copilot
```

En un proyecto de prueba, la variable de entorno `KIT_PLUGIN_ROOT` con la ruta `…\multiagent-kit-copilot\plugins\multiagent-kit` hace que `kit.js` use esa copia directamente (`$env:KIT_PLUGIN_ROOT="…"` en PowerShell, `export KIT_PLUGIN_ROOT=…` en macOS). Al terminar, `copilot plugin marketplace remove carlos-kits-copilot --force` y vuelve a añadir el de GitHub.

---
Anterior: [05-arquitectura-viva.md](05-arquitectura-viva.md) · Siguiente: [07-problemas-frecuentes.md](07-problemas-frecuentes.md) · [Índice](../README.md)
