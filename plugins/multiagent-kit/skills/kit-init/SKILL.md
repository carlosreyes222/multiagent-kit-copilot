---
name: kit-init
description: Inicializa el proyecto actual para usar el kit multiagente — crea pipeline.config.json, AGENTS.md, kit.js, .github/ (agentes, skills, prompts, hooks, instrucciones) y plantillas sin sobrescribir nada que ya exista. Uso — /kit-init
disable-model-invocation: true
allowed-tools: ["read", "search", "execute"]
---

Inicializa este proyecto para el kit multiagente.

1. Si `kit.js` ya existe en el proyecto, ejecuta `node kit.js init` (o `node kit.js update` para refrescar) y salta al paso 3.
   Si no, localiza el plugin instalado: busca el archivo `scripts/cli.js` dentro de `~/.copilot/installed-plugins/*/multiagent-kit/` (en Windows `%USERPROFILE%\.copilot\installed-plugins`). Si no existe, el plugin no está instalado: indica al usuario `copilot plugin install multiagent-kit@carlos-kits-copilot` y detente. Si el usuario indica una ruta local del plugin (desarrollo), úsala.
2. Ejecuta: `node "<ruta>/scripts/cli.js" init` (funciona igual en Windows, macOS y Linux; requiere Node ≥ 18). Convierte solo un `pipeline.config.ps1` antiguo a `pipeline.config.json`.
3. Muestra al usuario la salida: qué se creó, qué se fusionó y qué ya existía (los `.kit` que debe revisar). Los archivos de `.github/` que copia el kit se refrescan con `node kit.js update` mientras no los edites (se comprueba con `.github/kit-manifest.json`); para personalizar, crea otros al lado.
4. Lee `pipeline.config.json` y, mirando el código del proyecto (package.json, *.csproj, pyproject.toml, project.godot…), PROPÓN valores concretos para `INSTALL_CMD`, `BUILD_CMD`, `TEST_CMD`, `LINT_CMD`, `BASE_IMAGE` y `CONTAINER_CMD`. No los escribas sin confirmación: preséntalos y pregunta si los aplicas.
5. Si el proyecto está vacío (solo la idea), dile al usuario que no necesita rellenar los comandos: `/pipeline "su idea"` propondrá el stack y creará el esqueleto.
6. Si `AGENTS.md` acaba de crearse, ofrece rellenar la descripción del proyecto a partir de lo que ves en el código.
7. Recuerda al usuario: en VS Code, recargar la ventana para que aparezcan los agentes (`@product-owner`…) y los prompts (`/pipeline`…); en la CLI, `/skills reload`.
