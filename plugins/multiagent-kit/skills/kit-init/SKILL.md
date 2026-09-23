---
name: kit-init
description: Inicializa el proyecto actual para usar el kit multiagente — deja pipeline.config.json, AGENTS.md y .pipeline/ (fuera de git) e instala agentes, skills, prompts y hooks en tu perfil de usuario y el comando global `kit`. Nada del kit queda en el repositorio. Uso — /kit-init
disable-model-invocation: true
allowed-tools: ["read", "search", "execute"]
---

Inicializa este proyecto para el kit multiagente.

0. **Nada del kit en el repositorio**: este kit solo tiene un modo. En el proyecto quedan `pipeline.config.json`, `AGENTS.md` y `.pipeline/`, excluidos de git; agentes, skills, prompts y hooks van al perfil (`~/.copilot/…` y prompts de usuario de VS Code); el comando global `kit` y las plantillas son por máquina. Lo único que se versiona es lo que producen los agentes (`docs/specs`, `docs/adr`, `docs/reviews`, `docs/epicas`, `docs/ARQUITECTURA.md`). No preguntes por modos. Si el proyecto tiene copias de una versión antigua (`.github/agents`, `kit.js`…), `kit doctor --fix --usuario` las retira.

1. Si `kit.js` ya existe en el proyecto, ejecuta `kit init --modo <modo>` (o `kit update`, que recuerda el modo) y salta al paso 3.
   Si no, localiza el plugin instalado: busca el archivo `scripts/cli.js` dentro de `~/.copilot/installed-plugins/*/multiagent-kit/` (en Windows `%USERPROFILE%\.copilot\installed-plugins`). Si no existe, el plugin no está instalado: indica al usuario `copilot plugin install multiagent-kit@carlos-kits-copilot` y detente. Si el usuario indica una ruta local del plugin (desarrollo), úsala.
2. Ejecuta: `node "<ruta>/scripts/cli.js" init --modo <modo>` (funciona igual en Windows, macOS y Linux; requiere Node ≥ 18). Convierte solo un `pipeline.config.ps1` antiguo a `pipeline.config.json`.
3. Muestra al usuario la salida: qué se creó, qué se fusionó y qué ya existía (los `.kit` que debe revisar). El perfil de usuario (`~/.copilot/…`, prompts de VS Code) se refresca con `kit update` mientras no lo edites; para personalizar, crea archivos al lado.
4. Lee `pipeline.config.json` y, mirando el código del proyecto (package.json, *.csproj, pyproject.toml, project.godot…), PROPÓN valores concretos para `INSTALL_CMD`, `BUILD_CMD`, `TEST_CMD`, `LINT_CMD`, `BASE_IMAGE` y `CONTAINER_CMD`. No los escribas sin confirmación: preséntalos y pregunta si los aplicas.
5. Si el proyecto está vacío (solo la idea), dile al usuario que no necesita rellenar los comandos: `/pipeline "su idea"` propondrá el stack y creará el esqueleto.
6. Si `AGENTS.md` acaba de crearse, ofrece rellenar la descripción del proyecto a partir de lo que ves en el código.
7. Recuerda al usuario: en VS Code, recargar la ventana para que aparezcan los agentes (`@product-owner`…) y los prompts (`/pipeline`…); en la CLI, `/skills reload`.

## SDKs del equipo
Si el proyecto consume librerías propias del equipo (paquetes npm `@org/…`, artefactos Maven internos, pods locales) o el usuario menciona un SDK, ofrece declararlos en `SDKS` de `pipeline.config.json` (nombre, tipo `npm|android|ios|comando`, paquete, ruta local y/o repo git con rama). Explica que con eso `/pipeline --sdk <nombre>` hace la feature de extremo a extremo (SDK → versión de trabajo local → integración en este proyecto) sin publicar nada. Ver la doc de SDKs del kit.

## Si algo no cuadra
`kit doctor` revisa plugin (versión frente a GitHub), archivos del proyecto, modo, hooks (lanza un evento de prueba), permisos, copias `.kit` y locks de git, y `kit doctor --fix` aplica los arreglos seguros. Úsalo antes de investigar a mano.
