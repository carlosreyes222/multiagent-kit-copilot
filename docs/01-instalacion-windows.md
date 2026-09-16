# 1. Instalación (Windows y macOS)

Una vez por PC. El kit está escrito en Node.js (que la CLI de Copilot ya exige), así que no necesita PowerShell ni bash especiales: los comandos `node kit.js …` y los hooks son idénticos en Windows, macOS, Linux y en el sandbox del cloud agent.

## 1.1 Windows

Abre una terminal (PowerShell o CMD) y ejecuta:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Docker.DockerDesktop -e      # solo para staging docker/compose
```

Cierra y vuelve a abrir la terminal para que el PATH se actualice.

## 1.2 macOS (y Linux)

```bash
xcode-select --install            # git
brew install node                 # Node LTS (>= 18)
brew install --cask docker        # solo para staging docker/compose
```

## 1.3 GitHub Copilot CLI (igual en todos los sistemas)

```bash
npm install -g @github/copilot
copilot          # la primera vez: /login y sigue el enlace
```

Requiere una suscripción a Copilot (individual, Business o Enterprise). En Business/Enterprise el administrador debe tener activada la política de Copilot CLI.

## 1.4 VS Code (opcional, para trabajar con `@agentes` y `/prompts`)

Instala VS Code y la extensión **GitHub Copilot Chat**. Con eso VS Code lee `.github/agents`, `.github/skills`, `.github/prompts` y `.github/hooks` del proyecto, que es lo que `node kit.js init` copia. No hace falta instalar el plugin para VS Code: el plugin es para la CLI y el cloud agent.

## 1.5 Instalar el plugin del kit

```bash
copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot
copilot plugin install multiagent-kit@carlos-kits-copilot
copilot plugin list
```

`carlosreyes222` es el usuario de GitHub donde está publicado el repositorio (ver [02-publicar-en-github.md](02-publicar-en-github.md)). Si el repositorio es privado, `copilot` usa la sesión de `/login`, así que cada PC debe tener acceso.

**Sin GitHub todavía:** registra el marketplace desde la carpeta local (los plugins con origen local se cargan "en vivo": cada cambio se ve al reiniciar la sesión):

```bash
copilot plugin marketplace add C:\Users\carr9\Documents\multiagent-kit-copilot     # Windows
copilot plugin marketplace add ~/Documents/multiagent-kit-copilot                 # macOS
copilot plugin install multiagent-kit@carlos-kits-copilot
```

## 1.6 Comprobar

Abre `copilot` en cualquier carpeta y escribe `/skills list`: deben aparecer `pipeline`, `analisis`, `bugfix`, `ideas`, `kit-init`, `metodo-*` y `stack-*`. Con `/agent` deben verse `director`, `product-owner`, `arquitecto`, etc. En un proyecto inicializado, `node kit.js check` muestra el sistema detectado y da las pistas de instalación de tu sistema (`winget`, `brew` o `apt`).

Siguiente: [03-usar-en-un-proyecto.md](03-usar-en-un-proyecto.md) (o [02](02-publicar-en-github.md) si aún no has publicado el kit).

---
Siguiente: [02-publicar-en-github.md](02-publicar-en-github.md) · [Índice](../README.md)
