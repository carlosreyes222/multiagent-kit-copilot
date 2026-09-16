# 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `copilot` no se reconoce tras instalar | PATH de npm no actualizado | Cierra y abre la terminal; `npm config get prefix` debe estar en el PATH |
| Los hooks no se ejecutan en Windows | No hay PowerShell 7 (`pwsh`) | `winget install Microsoft.PowerShell`; `.\kit.ps1 check` lo detecta |
| Los hooks no se ejecutan (VS Code o CLI) | Carpeta no confiada, o `disableAllHooks` | Confía en la carpeta cuando Copilot lo pida; revisa `~/.copilot/settings.json` y `.github/copilot/settings.json` |
| `/pipeline` no aparece en la CLI | Plugin no instalado o skills sin recargar | `copilot plugin list`; `/skills reload`; `/skills info pipeline` dice de dónde viene |
| `/pipeline` no aparece en VS Code | El proyecto no tiene `.github/prompts` o no recargaste la ventana | `/kit-init` (o `.\kit.ps1 init`) y *Developer: Reload Window* |
| `@director` no aparece en VS Code | Falta `.github/agents/` | `.\kit.ps1 init`; comprueba que `chat.agentFilesLocations` no excluye `.github/agents` |
| `/pipeline` dice que falta `pipeline.config.ps1` | Proyecto no inicializado | `/kit-init` |
| `kit.ps1` no encuentra el plugin | No instalado en este PC, o `COPILOT_HOME` distinto | `copilot plugin install multiagent-kit@carlos-kits-copilot`; o `$env:KIT_PLUGIN_ROOT` con una copia local |
| El agente no delega a los demás y hace todo él | La sesión no tiene la herramienta de subagentes, o el agente no tiene `agent` en `tools` | En la CLI usa el agente `director` (`/agent`); en VS Code verifica que el chat esté en modo agente; pide "delega al agente tester" explícitamente |
| Un commit del agente queda bloqueado | Lint o tests fallan (compuerta de commit) | Es lo esperado: el agente corrige. Para saltarla puntualmente: `$env:PIPELINE_SKIP_GATE=1` |
| `git push` bloqueado en `main` | Hook de ramas protegidas | Trabaja en `feature/*` y abre un PR; para merge hace falta `VEREDICTO: APROBADO` |
| El agente dice "Denied by preToolUse hook (hook errored)" | El hook falló (por ejemplo `pwsh` sin permisos de ejecución) | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`; prueba a mano: `echo '{"toolName":"bash","toolArgs":"{\"command\":\"git status\"}"}' \| pwsh -File .\kit.ps1 hook protect-main` |
| `.\kit.ps1 prod` dice PROMOCIÓN BLOQUEADA | Falta staging, smoke o seguridad | El mensaje indica cuál; ejecuta el paso que falta |
| El cloud agent no ejecuta los hooks | Solo lee `.github/hooks/*.json` del repo, con `bash` | Haz commit de `.github/hooks/kit.json` y `kit.ps1`; `pwsh` viene en `ubuntu-latest` |
| El cloud agent no encuentra el plugin | El sandbox no trae plugins instalados | `.github/copilot/settings.json` con `enabledPlugins` lo instala; si no, las skills y agentes ya están copiados en `.github/` y los hooks avisan y permiten |
| `docker: error during connect` | Docker Desktop cerrado | Ábrelo y espera *Engine running* |
| Staging no responde 200 en 60 s | `HEALTH_PATH` o `CONTAINER_CMD` incorrectos | `docker compose -f staging/docker-compose.staging.yml logs`; ajusta `pipeline.config.ps1` |
| Staging Docker no tiene sentido para mi proyecto (móvil, Supabase, juego) | `STAGING_PROVIDER` incorrecto | Ver [11-staging-por-proveedor.md](11-staging-por-proveedor.md) y [10-supabase.md](10-supabase.md) |
| Los informes o `ARQUITECTURA.md` son enormes | Límites no respetados | `kit.ps1 status` avisa; pide `@arquitecto MODO: DOCUMENTAR` para resumir; límites en `pipeline.config.ps1` |
| El investigador dice que no tiene búsqueda web | Tools `web` no disponibles (cloud agent no los tiene; red corporativa) | Usa `/ideas --mercado` desde la CLI o VS Code; el informe queda marcado "sin verificar" |
| Actualicé el plugin y no cambia nada en VS Code | Los archivos del proyecto son copias | `.\kit.ps1 update` y commit (ver [06](06-actualizar-el-kit.md)) |
| `update` no toca un archivo y deja un `.kit` | Lo habías modificado | Fusiona a mano o borra tu copia y repite `update` |

---
Anterior: [06-actualizar-el-kit.md](06-actualizar-el-kit.md) · Siguiente: [08-superficies-copilot.md](08-superficies-copilot.md) · [Índice](../README.md)
