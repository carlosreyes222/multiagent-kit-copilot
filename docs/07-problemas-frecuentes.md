# 7. Problemas frecuentes

## Instalación y superficies

| Síntoma | Causa probable | Solución |
|---|---|---|
| `copilot` no se reconoce tras instalar | PATH de npm no actualizado | Cierra y abre la terminal; `npm config get prefix` debe estar en el PATH |
| `kit` no se reconoce como comando | La terminal se abrió antes de que `init` añadiera `~/.multiagent-kit/bin` al PATH | Abre una terminal nueva (en VS Code, una terminal nueva o reinicia VS Code); si sigue, añade esa carpeta al PATH a mano o usa `node "$HOME/.multiagent-kit/bin/kit-launcher.js" <comando>` |
| `kit` no encuentra el plugin | No instalado en este PC con la CLI, o `COPILOT_HOME` distinto | `copilot plugin install bkit@bkit` (hace falta también si solo usas VS Code); o la variable de entorno `KIT_PLUGIN_ROOT` con una copia local |
| Con el kit de Claude Code también instalado, `kit pr` dice "'pr' es del kit de Copilot" o los hooks se comportan como el de Claude | Lanzadores de una versión anterior a la 2.1.0, que elegían el plugin más reciente de cualquiera de los dos kits | `kit update` regenera los lanzadores. Desde la 2.1.0 el sabor se decide por el proyecto (`AGENTS.md` → Copilot, `CLAUDE.md` → Claude) y los hooks de Copilot solo usan el plugin de Copilot. `kit help` muestra al final qué plugin usa |
| Los hooks no se ejecutan | `node` no está en el PATH de la sesión, carpeta no confiada o `disableAllHooks` | `node --version` en esa terminal; confía en la carpeta cuando Copilot lo pida; revisa `~/.copilot/settings.json`; `kit doctor` hace una prueba real del hook |
| `/pipeline` no aparece en la CLI | Plugin no instalado o skills sin recargar | `copilot plugin list`; `/skills reload`; `/skills info pipeline` dice de dónde viene |
| `/pipeline` no aparece en VS Code | Faltan los prompts en `User/prompts` o no recargaste la ventana | `kit update` y *Developer: Reload Window*; si `kit update` avisó de que no encontró la carpeta de VS Code, define `KIT_VSCODE_PROMPTS_DIR` (p. ej. perfiles de VS Code o VS Code Insiders) y repite |
| `@director` no aparece en VS Code | Igual que el anterior (los agentes van en `User/prompts`) | `kit update` y recargar; comprueba que `chat.agentFilesLocations` no excluye la carpeta de usuario |
| `/pipeline` dice que falta `pipeline.config.json` | Proyecto no inicializado | `/kit-init` |
| El agente no delega a los demás y hace todo él | La sesión no tiene la herramienta de subagentes, o el agente no tiene `agent` en `tools` | En la CLI usa el agente `director` (`/agent`); en VS Code verifica que el chat esté en modo agente; pide "delega al agente tester" explícitamente |
| Actualicé el plugin y no cambia nada en VS Code | El perfil tiene la versión anterior | `kit update` y *Developer: Reload Window* (ver [06](06-actualizar-el-kit.md)) |
| `update` no toca un archivo y deja un `.kit` | Lo habías modificado | Fusiona a mano o borra tu copia y repite `update` |
| Hice push del kit pero los agentes se comportan como antes | El plugin instalado en el PC es la versión anterior | `kit doctor` lo indica; actualiza el plugin y luego `kit update` |

## Hooks: comandos bloqueados

| Síntoma | Causa probable | Solución |
|---|---|---|
| Un commit del agente queda bloqueado (`COMMIT BLOQUEADO: Tests falló`) | Lint o tests fallan (compuerta de commit) | Es lo esperado: el agente corrige. Para saltarla puntualmente: variable de entorno `PIPELINE_SKIP_GATE=1` en la sesión |
| La compuerta de commit tarda demasiado | `TEST_CMD` ejecuta toda la suite en cada commit | Usa en `TEST_CMD` algo más rápido para el día a día (p. ej. `npx jest --ci --onlyChanged`); la suite completa la ejecuta el tester en QA y la CI del repositorio |
| `git push` bloqueado | Push a una rama protegida (también con `git -C`, `HEAD:main` o `--all`) | Trabaja en `feature/*`; el PR lo abre `kit pr` |
| `borrado recursivo no permitido` | `rm -r`, `Remove-Item -Recurse`, `rd /s`, `rimraf`… están bloqueados a los agentes | Si hace falta limpiar (`node_modules`, `android/build`), usa la herramienta del proyecto (`cd android && ./gradlew clean`) o hazlo tú en tu terminal |
| `archivo sensible (...)` | El agente intentó leer, copiar o versionar `.env`, keystores, `google-services.json`, `GoogleService-Info.plist`, `.p8`… | Es lo esperado. Documenta las variables en `.env.example`; los valores reales los pones tú |
| `pipeline.config.json no es JSON válido: los agentes no ejecutan comandos` | El archivo tiene un error de sintaxis (coma de más, comillas) | Corrígelo a mano; `kit doctor` muestra el error. Mientras tanto el hook solo deja pasar `kit doctor/check/status` y `git status/diff/log` |
| `error interno del hook` | Fallo inesperado del propio hook con un comando raro | `kit doctor`; reporta el comando exacto al mantenedor del kit (y añádelo a `test/hook-protect.test.js`) |
| El agente dice "Denied by preToolUse hook (hook errored)" | El hook no pudo arrancar (Node antiguo, plugin no encontrado) | `node --version` (≥ 18); prueba a mano: `echo '{"toolName":"bash","toolArgs":"{\"command\":\"git status\"}"}' \| kit hook protect-main` |
| Un comando legítimo queda bloqueado | Falso positivo del parser (p. ej. un argumento que parece un archivo sensible) | Reformúlalo (el mensaje dice qué detectó) o ejecútalo tú; reporta el caso para añadirlo a las pruebas |

## Estado, revisiones y PR

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Valor no válido para qa: 'APROBAD'` | `kit state` valida los valores contra el esquema | Usa uno de los valores que lista el mensaje de error |
| `El estado está bloqueado por otro proceso` | Un `kit state` sigue en marcha o murió a mitad | Si no hay ningún agente trabajando, borra `.pipeline/state.json.lock` (se ignora solo pasados 30 s) |
| `state.json estaba corrupto; lo guardé como state.json.corrupto-…` | El archivo se dañó (edición a mano, disco) | El estado empieza limpio; recupera a mano lo que necesites de la copia y regístralo con `kit state …` |
| Un pipeline nuevo hereda veredictos o `sdk` de la feature anterior | Estado no cerrado | `kit state reset` |
| `PR BLOQUEADO: … revisó abc123, pero después cambió código` | El implementador corrigió algo después de QA o de una revisión | Repite la etapa afectada (QA o revisiones); el informe nuevo declara el `COMMIT:` actual. No edites el `COMMIT:` a mano |
| `PR BLOQUEADO: … veredictos contradictorios` | El informe tiene `APROBADO` y `RECHAZADO` (la línea de la plantilla o de una iteración anterior) | Deja una sola línea de veredicto en el informe y commitéalo |
| `kit pr` avisa `no indica 'COMMIT: <sha>'` | Informe escrito por agentes de una versión anterior | No bloquea; en la siguiente revisión el agente lo añadirá |
| `kit pr` dice `La rama base 'x' no existe` | Nombre de la base mal escrito o no publicada | `kit state pr_base=<rama>` con el nombre correcto (`git branch -r` lista las remotas) |
| `kit pr` avisa de que la rama va por detrás o de conflictos | La base avanzó durante el pipeline | Integra la base (`git merge origin/<base>`), deja que el tester repita QA y vuelve a lanzar `kit pr` |
| `kit pr` dice `PR: RAMA SUBIDA (gh …)` (código 2) | `gh` no instalado o sin sesión | `winget install GitHub.cli` / `brew install gh` y `gh auth login`; mientras tanto abre el PR con `docs/reviews/<slug>-pr.md` |
| `kit pr` dice `PR: RAMA LOCAL (push falló …)` (código 2) | Sin permisos, sin remoto o la rama remota tiene commits nuevos | Resuelve la causa (permisos, `git pull --rebase` si procede) y repite `kit pr`; nunca `--force` |
| Los informes o `ARQUITECTURA.md` son enormes | Límites no respetados | `kit status` avisa; pide `@arquitecto MODO: DOCUMENTAR` para resumir; límites en `pipeline.config.json` |

## Otros

| Síntoma | Causa probable | Solución |
|---|---|---|
| El investigador dice que no tiene búsqueda web | Herramientas `web` no disponibles (red corporativa) | Usa `/ideas --mercado` desde la CLI o VS Code con red; el informe queda marcado "sin verificar" |
| `sdk pack` no encuentra la dependencia en el padre | El paquete no está en `package.json` / `libs.versions.toml` / `Podfile`, o está en otra carpeta | Añade la dependencia una vez a mano (cualquier versión) o indica `destino` en la entrada de `SDKS`; repite `sdk pack` |
| `sdk sync` dice que el clon tiene cambios sin commit | Una feature en curso en `.pipeline/sdks/<nombre>` | Es lo esperado: termina o commitea esa feature; el kit no cambia de rama ni hace pull con cambios pendientes |
| `git commit` dice `index.lock` exists | Un git anterior se interrumpió | `kit doctor --fix` borra los locks de más de 10 minutos (si no hay ningún git en marcha) |
| Un agente busca `docs/specs/_PLANTILLA.md` y no existe | Las plantillas viven en el plugin | Es normal; `kit plantilla spec` da la ruta. Si el agente insiste, actualiza el plugin (skills antiguas) |
| El kit avisa "proyecto Expo" y se detiene | El kit es solo para RN bare (CLI) | Usa el kit de Claude o migra el proyecto a bare |

---
Anterior: [06-actualizar-el-kit.md](06-actualizar-el-kit.md) · Siguiente: [08-superficies-copilot.md](08-superficies-copilot.md) · [Índice](../README.md)
