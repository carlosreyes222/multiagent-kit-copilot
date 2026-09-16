# 2. Publicar el kit en GitHub

Una sola vez. Después, cada mejora se publica con `git push` (ver [06-actualizar-el-kit.md](06-actualizar-el-kit.md)).

## 2.1 Crear el repositorio

Crea en GitHub un repositorio vacío llamado `multiagent-kit-copilot`. Puede ser privado: en ese caso cada PC que lo use debe haber hecho `/login` en `copilot` con una cuenta con acceso.

## 2.2 Poner tu usuario

El kit ya trae el usuario `carlosreyes222`. Si publicas bajo otro usuario u organización, reemplázalo en:

- `plugins/multiagent-kit/plugin.json` (`homepage`, `repository`, `author.url`)
- `plugins/multiagent-kit/templates/github/copilot/settings.json` (`extraKnownMarketplaces`)
- `plugins/multiagent-kit/templates/kit.ps1` (mensaje de instalación)
- `docs/*.md` y `README.md` (comandos de ejemplo)

Desde la carpeta del repositorio, en PowerShell 7:

```powershell
Get-ChildItem -Recurse -Include *.json,*.md,*.ps1 | ForEach-Object {
  (Get-Content $_.FullName -Raw) -replace 'carlosreyes222', 'tu-usuario-real' | Set-Content $_.FullName -Encoding UTF8
}
```

## 2.3 Subir

```powershell
cd "$HOME\Documents\multiagent-kit-copilot"
git init -b main
git add .
git commit -m "multiagent-kit para Copilot 1.0.0"
git remote add origin https://github.com/carlosreyes222/multiagent-kit-copilot.git
git push -u origin main
```

## 2.4 Instalar desde GitHub en cualquier PC

```powershell
copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot
copilot plugin install multiagent-kit@carlos-kits-copilot
```

Copilot busca `marketplace.json` en `.github/plugin/` del repositorio (también aceptaría `.claude-plugin/`). El nombre del marketplace es el `name` del archivo (`carlos-kits-copilot`), no se puede cambiar al registrarlo.

## 2.5 Para la organización (opcional)

Si el equipo debe recibir el plugin sin instalarlo a mano, cada repositorio de proyecto lleva `.github/copilot/settings.json` con `extraKnownMarketplaces` y `enabledPlugins` (lo copia `kit.ps1 init`): la CLI y el cloud agent instalan el plugin automáticamente al abrir ese repositorio. Para los agentes en VS Code a nivel de organización, se pueden publicar también en el repositorio `.github` de la organización, carpeta `agents/` (ver [09-cloud-agent-y-github.md](09-cloud-agent-y-github.md)).

---
Anterior: [01-instalacion-windows.md](01-instalacion-windows.md) · Siguiente: [03-usar-en-un-proyecto.md](03-usar-en-un-proyecto.md) · [Índice](../README.md)
