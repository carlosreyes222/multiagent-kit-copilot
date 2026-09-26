# 1. Instalación (Windows y macOS)

Una vez por PC. El kit está escrito en Node.js (que la CLI de Copilot ya exige), así que no necesita PowerShell ni bash especiales: los comandos `kit …` y los hooks son idénticos en Windows y macOS. Para React Native necesitas además el toolchain habitual (JDK 17 y Android Studio con SDK/emulador; en macOS Xcode y CocoaPods para iOS), que `kit check` comprueba sin exigirlo.

## 1.1 Windows

Abre una terminal (PowerShell o CMD) y ejecuta:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id GitHub.cli -e                # gh: el kit abre los pull requests con él (gh auth login después)
```

Cierra y vuelve a abrir la terminal para que el PATH se actualice.

## 1.2 macOS (y Linux)

```bash
xcode-select --install            # git
brew install node                 # Node LTS (>= 18)
brew install gh                                  # gh: el kit abre los pull requests con él
```

## 1.3 GitHub Copilot CLI (igual en todos los sistemas)

```bash
npm install -g @github/copilot
copilot          # la primera vez: /login y sigue el enlace
```

Requiere una suscripción a Copilot (individual, Business o Enterprise). En Business/Enterprise el administrador debe tener activada la política de Copilot CLI.

## 1.4 VS Code (opcional, para trabajar con `@agentes` y `/prompts`)

Instala VS Code y la extensión **GitHub Copilot Chat**. Es donde usarás el kit a diario (`/pipeline`, `@arquitecto`…); los comandos `kit …` se ejecutan en su terminal integrada (PowerShell en Windows, zsh en macOS). `kit init` instala en tu perfil lo que VS Code necesita: agentes, prompts y `kit.instructions.md` en `User/prompts`, skills en `~/.copilot/skills` y hooks en `~/.copilot/hooks`. VS Code no instala el plugin: los hooks y el comando `kit` usan el que instala la CLI en el paso siguiente, así que la CLI hace falta aunque solo trabajes en VS Code.

## 1.5 Instalar el plugin del kit

```bash
copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot
copilot plugin install bkit@bkit
copilot plugin list
```

`carlosreyes222/multiagent-kit-copilot` es el repositorio de GitHub donde está publicado el kit (ver [02-publicar-en-github.md](02-publicar-en-github.md)). Si el repositorio es privado, `copilot` usa la sesión de `/login`, así que cada PC debe tener acceso.

**Sin GitHub todavía:** registra el marketplace desde la carpeta local (los plugins con origen local se cargan "en vivo": cada cambio se ve al reiniciar la sesión):

```bash
copilot plugin marketplace add C:\Users\carr9\Documents\multiagent-kit-copilot     # Windows
copilot plugin marketplace add ~/Documents/multiagent-kit-copilot                 # macOS
copilot plugin install bkit@bkit
```

## 1.6 Comprobar

Abre `copilot` en cualquier carpeta y escribe `/skills list`: deben aparecer `pipeline`, `analisis`, `bugfix`, `ideas`, `kit-init`, `metodo-*` y `stack-*`. Con `/agent` deben verse `director`, `product-owner`, `arquitecto`, etc. En un proyecto inicializado, `kit check` muestra el sistema detectado y da las pistas de instalación de tu sistema (`winget`, `brew` o `apt`).

Siguiente: [03-usar-en-un-proyecto.md](03-usar-en-un-proyecto.md) (o [02](02-publicar-en-github.md) si aún no has publicado el kit).

---
Siguiente: [02-publicar-en-github.md](02-publicar-en-github.md) · [Índice](../README.md)
