---
name: kit-init
description: Inicializa el proyecto actual para usar el kit multiagente — crea pipeline.config.ps1, AGENTS.md, kit.ps1, .github/ (agentes, skills, prompts, hooks, instrucciones) y plantillas sin sobrescribir nada que ya exista. Uso — /kit-init
disable-model-invocation: true
allowed-tools: ["read", "search", "execute"]
---

Inicializa este proyecto para el kit multiagente.

1. Localiza el script de inicialización del plugin instalado (funciona en Windows, macOS y Linux):
   `pwsh -NoProfile -Command "(Get-ChildItem (Join-Path $HOME '.copilot/installed-plugins') -Recurse -Filter init-proyecto.ps1 | Select-Object -First 1).FullName"`
   Si no devuelve nada, el plugin no está instalado: indica al usuario `copilot plugin install multiagent-kit@carlos-kits-copilot` y detente. Si el usuario indica una ruta local del plugin (desarrollo), úsala.
2. Ejecuta: `pwsh -NoProfile -File "<ruta encontrada>"` (o `pwsh -NoProfile -File kit.ps1 init` si `kit.ps1` ya existe en el proyecto).
3. Muestra al usuario la salida: qué se creó, qué se fusionó y qué ya existía (los `.kit` que debe revisar). Los archivos de `.github/` que copia el kit llevan una cabecera `multiagent-kit-copilot` y se refrescan con `kit.ps1 update`; no los edites a mano (crea otros al lado).
4. Lee `pipeline.config.ps1` y, mirando el código del proyecto (package.json, *.csproj, pyproject.toml, project.godot…), PROPÓN valores concretos para `INSTALL_CMD`, `BUILD_CMD`, `TEST_CMD`, `LINT_CMD`, `BASE_IMAGE` y `CONTAINER_CMD`. No los escribas sin confirmación: preséntalos y pregunta si los aplicas.
5. Si el proyecto está vacío (solo la idea), dile al usuario que no necesita rellenar los comandos: `/pipeline "su idea"` propondrá el stack y creará el esqueleto.
6. Si `AGENTS.md` acaba de crearse, ofrece rellenar la descripción del proyecto a partir de lo que ves en el código.
7. Recuerda al usuario: en VS Code, recargar la ventana para que aparezcan los agentes (`@product-owner`…) y los prompts (`/pipeline`…); en la CLI, `/skills reload`.
