# 1. Instalación en Windows

Una vez por PC. Todo en **PowerShell 7** (`pwsh`), no en CMD ni en Windows PowerShell 5.1: los hooks de Copilot en Windows requieren PowerShell 7.

## 1.1 PowerShell 7

```powershell
winget install --id Microsoft.PowerShell --source winget
```

Cierra la terminal, abre **PowerShell 7** (el icono negro "PowerShell 7", o escribe `pwsh` en cualquier terminal) y comprueba:

```powershell
$PSVersionTable.PSVersion     # debe empezar por 7
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Los scripts del kit funcionan también en Windows PowerShell 5.1, pero los **hooks** (ramas protegidas, compuerta de commit) los lanza Copilot con `pwsh`, así que sin PowerShell 7 no se ejecutan.

## 1.2 Git y Node.js

```powershell
winget install --id Git.Git
winget install --id OpenJS.NodeJS.LTS
```

## 1.3 GitHub Copilot CLI

```powershell
npm install -g @github/copilot
copilot          # la primera vez: /login y sigue el enlace
```

Requiere una suscripción a Copilot (individual, Business o Enterprise). En Business/Enterprise el administrador debe tener activada la política de Copilot CLI.

## 1.4 VS Code (opcional, para trabajar con `@agentes` y `/prompts`)

Instala VS Code y la extensión **GitHub Copilot Chat**. Con eso VS Code lee `.github/agents`, `.github/skills`, `.github/prompts` y `.github/hooks` del proyecto, que es lo que `kit.ps1 init` copia. No hace falta instalar el plugin para VS Code: el plugin es para la CLI y el cloud agent.

## 1.5 Docker Desktop (solo si usarás staging `docker` o `compose`)

```powershell
winget install --id Docker.DockerDesktop
```

Para proyectos móviles, Supabase o juegos hay otros proveedores de staging que no necesitan Docker: ver [11-staging-por-proveedor.md](11-staging-por-proveedor.md).

## 1.6 Instalar el plugin del kit

```powershell
copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot
copilot plugin install multiagent-kit@carlos-kits-copilot
copilot plugin list
```

`carlosreyes222` es el usuario de GitHub donde está publicado el repositorio (ver [02-publicar-en-github.md](02-publicar-en-github.md)). Si el repositorio es privado, `copilot` usa la sesión de `/login`, así que cada PC debe tener acceso.

**Sin GitHub todavía:** registra el marketplace desde la carpeta local (los plugins con origen local se cargan "en vivo": cada cambio se ve al reiniciar la sesión):

```powershell
copilot plugin marketplace add C:\Users\carr9\Documents\multiagent-kit-copilot
copilot plugin install multiagent-kit@carlos-kits-copilot
```

## 1.7 Comprobar

Abre `copilot` en cualquier carpeta y escribe `/skills list`: deben aparecer `pipeline`, `analisis`, `bugfix`, `ideas`, `kit-init`, `metodo-*` y `stack-*`. Con `/agent` deben verse `director`, `product-owner`, `arquitecto`, etc.

Siguiente: [03-usar-en-un-proyecto.md](03-usar-en-un-proyecto.md) (o [02](02-publicar-en-github.md) si aún no has publicado el kit).

---
Siguiente: [02-publicar-en-github.md](02-publicar-en-github.md) · [Índice](../README.md)
