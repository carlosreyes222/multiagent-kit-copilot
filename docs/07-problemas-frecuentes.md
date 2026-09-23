# 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `copilot` no se reconoce tras instalar | PATH de npm no actualizado | Cierra y abre la terminal; `npm config get prefix` debe estar en el PATH |
| Los hooks no se ejecutan | `node` no está en el PATH de la sesión, carpeta no confiada o `disableAllHooks` | `node --version` en esa terminal; confía en la carpeta cuando Copilot lo pida; revisa `~/.copilot/settings.json` y `.github/copilot/settings.json` |
| `/pipeline` no aparece en la CLI | Plugin no instalado o skills sin recargar | `copilot plugin list`; `/skills reload`; `/skills info pipeline` dice de dónde viene |
| `/pipeline` no aparece en VS Code | El proyecto no tiene `.github/prompts` o no recargaste la ventana | `/kit-init` (o `kit init`) y *Developer: Reload Window* |
| `@director` no aparece en VS Code | Falta `.github/agents/` | `kit init`; comprueba que `chat.agentFilesLocations` no excluye `.github/agents` |
| `/pipeline` dice que falta `pipeline.config.json` | Proyecto no inicializado | `/kit-init` |
| `kit.js` no encuentra el plugin | No instalado en este PC, o `COPILOT_HOME` distinto | `copilot plugin install multiagent-kit@carlos-kits-copilot`; o la variable de entorno `KIT_PLUGIN_ROOT` con una copia local |
| El agente no delega a los demás y hace todo él | La sesión no tiene la herramienta de subagentes, o el agente no tiene `agent` en `tools` | En la CLI usa el agente `director` (`/agent`); en VS Code verifica que el chat esté en modo agente; pide "delega al agente tester" explícitamente |
| Un commit del agente queda bloqueado | Lint o tests fallan (compuerta de commit) | Es lo esperado: el agente corrige. Para saltarla puntualmente: variable de entorno `PIPELINE_SKIP_GATE=1` |
| `git push` bloqueado en `main` | Hook de ramas protegidas | Trabaja en `feature/*` y abre un PR; para merge hace falta `VEREDICTO: APROBADO` |
| El agente dice "Denied by preToolUse hook (hook errored)" | El hook falló (Node antiguo, `kit.js` ausente) | `node --version` (≥ 18); prueba a mano: `echo '{"toolName":"bash","toolArgs":"{\\"command\\":\\"git status\\"}"}' \| kit hook protect-main` |
| El cloud agent no ejecuta los hooks | Solo lee `.github/hooks/*.json` del repo, con `bash` | Haz commit de `.github/hooks/kit.json` y `kit.js`; Node viene en `ubuntu-latest` |
| El cloud agent no encuentra el plugin | El sandbox no trae plugins instalados | `.github/copilot/settings.json` con `enabledPlugins` lo instala; si no, las skills y agentes ya están copiados en `.github/` y los hooks avisan y permiten |
| Los informes o `ARQUITECTURA.md` son enormes | Límites no respetados | `kit status` avisa; pide `@arquitecto MODO: DOCUMENTAR` para resumir; límites en `pipeline.config.json` |
| El investigador dice que no tiene búsqueda web | Tools `web` no disponibles (cloud agent no los tiene; red corporativa) | Usa `/ideas --mercado` desde la CLI o VS Code; el informe queda marcado "sin verificar" |
| Actualicé el plugin y no cambia nada en VS Code | Los archivos del proyecto son copias | `kit update` y commit (ver [06](06-actualizar-el-kit.md)) |
| `update` no toca un archivo y deja un `.kit` | Lo habías modificado | Fusiona a mano o borra tu copia y repite `update` |
| `sdk pack` no encuentra la dependencia en el padre | El paquete no está en `package.json` / `libs.versions.toml` / `Podfile`, o está en otra carpeta | Añade la dependencia una vez a mano (cualquier versión) o indica `destino` en la entrada de `SDKS`; repite `sdk pack` |
| `sdk sync` dice que el clon tiene cambios sin commit | Una feature en curso en `.pipeline/sdks/<nombre>` | Es lo esperado: termina o commitea esa feature; el kit no cambia de rama ni hace pull con cambios pendientes |
| Hice push del kit pero los agentes se comportan como antes | El plugin instalado en el PC es la versión anterior | `kit doctor` lo indica; actualiza el plugin y luego `kit update` |
| `git commit` dice `index.lock` exists | Un git anterior se interrumpió | `kit doctor --fix` borra los locks de más de 10 minutos (si no hay ningún git en marcha) |
| Un pipeline nuevo hereda veredictos o `sdk` de la feature anterior | Estado no cerrado | `kit state reset` |
| `kit` no se reconoce como comando | La terminal se abrió antes de que `init` añadiera `~/.multiagent-kit/bin` al PATH | Abre una terminal nueva; si sigue, añade esa carpeta al PATH a mano o usa `node "$HOME/.multiagent-kit/bin/kit-launcher.js" <comando>` |
| Un agente busca `docs/specs/_PLANTILLA.md` y no existe | Proyecto en modo usuario: las plantillas viven en el plugin | Es normal; `kit plantilla spec` da la ruta. Si el agente insiste, actualiza el plugin (skills antiguas) |
| `kit pr` dice `PR: RAMA SUBIDA (gh …)` | `gh` no instalado o sin sesión | `winget install GitHub.cli` / `brew install gh` y `gh auth login`; mientras tanto abre el PR con `docs/reviews/<slug>-pr.md` |
| `kit pr` dice `PR: RAMA LOCAL (push falló …)` | Sin permisos, sin remoto o la rama remota tiene commits nuevos | Resuelve la causa (permisos, `git pull --rebase` si procede) y repite `kit pr`; nunca `--force` |
| El kit avisa "proyecto Expo" y se detiene | El kit es solo para RN bare (CLI) | Usa el kit de Claude o migra el proyecto a bare |

---
Anterior: [06-actualizar-el-kit.md](06-actualizar-el-kit.md) · Siguiente: [08-superficies-copilot.md](08-superficies-copilot.md) · [Índice](../README.md)

