---
name: kit-init
description: Inicializa el proyecto actual para usar el kit multiagente — crea pipeline.config.json, AGENTS.md, kit.js, .github/ (agentes, skills, prompts, hooks, instrucciones) y plantillas sin sobrescribir nada que ya exista. Uso — /kit-init
disable-model-invocation: true
allowed-tools: ["read", "search", "execute"]
---

Inicializa este proyecto para el kit multiagente.

0. **Pregunta el modo** si el usuario no lo indicó (una sola pregunta, con estas tres opciones):
   - `repo` (por defecto): los archivos del kit se copian a `.github/` y se versionan; el equipo y el cloud agent los usan.
   - `local`: igual, pero todo queda en `.git/info/exclude` (solo en este clon, nada aparece en git).
   - `usuario`: nada del kit en el repositorio; agentes, skills, prompts y hooks se instalan en el perfil (`~/.copilot/…` y prompts de usuario de VS Code) y valen para todos los proyectos. Recomendado en repositorios ajenos o del trabajo. El cloud agent no los ve.
   Pásalo como `--modo <repo|local|usuario>`.

1. Si `kit.js` ya existe en el proyecto, ejecuta `node kit.js init --modo <modo>` (o `node kit.js update`, que recuerda el modo) y salta al paso 3.
   Si no, localiza el plugin instalado: busca el archivo `scripts/cli.js` dentro de `~/.copilot/installed-plugins/*/multiagent-kit/` (en Windows `%USERPROFILE%\.copilot\installed-plugins`). Si no existe, el plugin no está instalado: indica al usuario `copilot plugin install multiagent-kit@carlos-kits-copilot` y detente. Si el usuario indica una ruta local del plugin (desarrollo), úsala.
2. Ejecuta: `node "<ruta>/scripts/cli.js" init --modo <modo>` (funciona igual en Windows, macOS y Linux; requiere Node ≥ 18). Convierte solo un `pipeline.config.ps1` antiguo a `pipeline.config.json`.
3. Muestra al usuario la salida: qué se creó, qué se fusionó y qué ya existía (los `.kit` que debe revisar). Los archivos de `.github/` que copia el kit se refrescan con `node kit.js update` mientras no los edites (se comprueba con `.github/kit-manifest.json`); para personalizar, crea otros al lado.
4. Lee `pipeline.config.json` y, mirando el código del proyecto (package.json, *.csproj, pyproject.toml, project.godot…), PROPÓN valores concretos para `INSTALL_CMD`, `BUILD_CMD`, `TEST_CMD`, `LINT_CMD`, `BASE_IMAGE` y `CONTAINER_CMD`. No los escribas sin confirmación: preséntalos y pregunta si los aplicas.
5. Si el proyecto está vacío (solo la idea), dile al usuario que no necesita rellenar los comandos: `/pipeline "su idea"` propondrá el stack y creará el esqueleto.
6. Si `AGENTS.md` acaba de crearse, ofrece rellenar la descripción del proyecto a partir de lo que ves en el código.
7. Recuerda al usuario: en VS Code, recargar la ventana para que aparezcan los agentes (`@product-owner`…) y los prompts (`/pipeline`…); en la CLI, `/skills reload`.

## SDKs del equipo
Si el proyecto consume librerías propias del equipo (paquetes npm `@org/…`, artefactos Maven internos, pods locales) o el usuario menciona un SDK, ofrece declararlos en `SDKS` de `pipeline.config.json` (nombre, tipo `npm|android|ios|comando`, paquete, ruta local y/o repo git con rama). Explica que con eso `/pipeline --sdk <nombre>` hace la feature de extremo a extremo (SDK → versión de trabajo local → integración en este proyecto) sin publicar nada. Ver la doc de SDKs del kit.

## Si algo no cuadra
`node kit.js doctor` revisa plugin (versión frente a GitHub), archivos del proyecto, modo, hooks (lanza un evento de prueba), permisos, copias `.kit` y locks de git, y `node kit.js doctor --fix` aplica los arreglos seguros. Úsalo antes de investigar a mano.
