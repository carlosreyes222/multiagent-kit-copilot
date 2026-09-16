# Inicializa (o actualiza) un proyecto para usar el kit con GitHub Copilot.
# Dos tipos de archivo:
#   - TUYOS (pipeline.config.ps1, AGENTS.md, staging/, docs/, settings, workflow): se crean si faltan y NUNCA se sobrescriben
#     (si hay una versión nueva del kit, queda al lado con sufijo .kit; .gitignore/.dockerignore se fusionan).
#   - GESTIONADOS por el kit (.github/agents, .github/skills, .github/prompts, .github/hooks/kit.json,
#     .github/instructions/kit.instructions.md, kit.ps1): se copian del plugin y se refrescan con `kit.ps1 update`
#     mientras no los hayas modificado (se comprueba con el hash guardado en .github/kit-manifest.json).
# Uso:  kit.ps1 init | kit.ps1 update      (o)  pwsh -File <plugin>/scripts/init-proyecto.ps1 [-Destino ruta] [-Update]
param([string]$Destino = "", [switch]$Update)
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new() } catch {}

if (-not $Destino) { $Destino = $env:KIT_PROJECT_DIR }
if (-not $Destino) { $Destino = (Get-Location).Path }
$pluginRoot = Split-Path -Parent $PSScriptRoot
$tpl = Join-Path $pluginRoot "templates"
$version = (Get-Content (Join-Path $pluginRoot "plugin.json") -Raw | ConvertFrom-Json).version

if (-not (Test-Path (Join-Path $Destino ".git"))) {
    Write-Host "AVISO: '$Destino' no es un repositorio git. Los hooks de ramas protegidas necesitan git." -ForegroundColor Yellow
}
$accion = if ($Update) { "Actualizando" } else { "Inicializando" }
Write-Host "$accion kit multiagente para Copilot v$version en $Destino" -ForegroundColor Cyan

$creados = @(); $conservados = @(); $fusionados = @(); $actualizados = @(); $modificados = @()

# Manifiesto de archivos gestionados (se versiona en el proyecto para que todo el equipo actualice igual)
$manifestPath = Join-Path $Destino ".github/kit-manifest.json"
$manifest = @{ version = ""; files = @{} }
if (Test-Path $manifestPath) {
    try {
        $m = Get-Content $manifestPath -Raw | ConvertFrom-Json
        $manifest.version = [string]$m.version
        foreach ($p in $m.files.PSObject.Properties) { $manifest.files[$p.Name] = [string]$p.Value }
    } catch {}
}
function Get-Hash([string]$path) { return (Get-FileHash $path -Algorithm SHA256).Hash }

function Copy-Safe([string]$rel, [string]$destRel = $rel) {
    $src = Join-Path $tpl $rel
    $dst = Join-Path $Destino $destRel
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    if (Test-Path $dst) {
        if ((Get-Hash $src) -eq (Get-Hash $dst)) { return }
        Copy-Item $src "$dst.kit" -Force
        $script:conservados += "$destRel  (nueva versión en $destRel.kit)"
    } else {
        Copy-Item $src $dst
        $script:creados += $destRel
    }
}

function Merge-Lines([string]$rel) {
    $src = Join-Path $tpl $rel
    $dst = Join-Path $Destino $rel
    if (-not (Test-Path $dst)) { Copy-Item $src $dst; $script:creados += $rel; return }
    $existing = Get-Content $dst
    $missing = Get-Content $src | Where-Object { $_ -and $_ -notmatch '^\s*#' -and ($existing -notcontains $_) }
    if ($missing) {
        Add-Content $dst ("`n# --- añadido por multiagent-kit-copilot ---`n" + ($missing -join "`n"))
        $script:fusionados += "$rel  (+$($missing.Count) líneas)"
    }
}

# Archivo gestionado: se sobrescribe solo si el usuario no lo tocó desde la última copia del kit.
function Install-Managed([string]$srcAbs, [string]$destRel) {
    $dst = Join-Path $Destino $destRel
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    $key = $destRel -replace "\\", "/"
    $srcHash = Get-Hash $srcAbs
    if (-not (Test-Path $dst)) {
        Copy-Item $srcAbs $dst; $script:creados += $destRel; $manifest.files[$key] = $srcHash; return
    }
    $cur = Get-Hash $dst
    if ($cur -eq $srcHash) { $manifest.files[$key] = $srcHash; return }
    $known = $manifest.files[$key]
    if ($known -and $cur -eq $known) {
        Copy-Item $srcAbs $dst -Force; $script:actualizados += $destRel; $manifest.files[$key] = $srcHash
    } else {
        Copy-Item $srcAbs "$dst.kit" -Force
        $script:modificados += "$destRel  (lo modificaste; la versión nueva está en $destRel.kit)"
    }
}

# --- Archivos tuyos ---
Copy-Safe "pipeline.config.ps1"
Copy-Safe "AGENTS.md"
Copy-Safe "github/copilot-instructions.md" ".github/copilot-instructions.md"
Copy-Safe "github/copilot/settings.json" ".github/copilot/settings.json"
Copy-Safe "github/workflows/copilot-setup-steps.yml" ".github/workflows/copilot-setup-steps.yml"
Copy-Safe "staging/docker-compose.staging.yml"
Copy-Safe "staging/Dockerfile.staging"
Copy-Safe "staging/env.staging.example" "staging/.env.staging"
Copy-Safe "docs/_PLANTILLA-ARQUITECTURA.md"
Copy-Safe "docs/specs/_PLANTILLA.md"
Copy-Safe "docs/adr/_PLANTILLA.md"
Copy-Safe "docs/reviews/_PLANTILLA-seguridad.md"
Merge-Lines ".gitignore"
Merge-Lines ".dockerignore"

# --- Archivos gestionados por el kit ---
Install-Managed (Join-Path $tpl "kit.ps1") "kit.ps1"
Install-Managed (Join-Path $tpl "github/hooks/kit.json") ".github/hooks/kit.json"
Install-Managed (Join-Path $tpl "github/instructions/kit.instructions.md") ".github/instructions/kit.instructions.md"
Get-ChildItem (Join-Path $pluginRoot "com.github.copilot/agents") -Filter "*.agent.md" | ForEach-Object {
    Install-Managed $_.FullName ".github/agents/$($_.Name)"
}
Get-ChildItem (Join-Path $pluginRoot "skills") -Directory | ForEach-Object {
    Install-Managed (Join-Path $_.FullName "SKILL.md") ".github/skills/$($_.Name)/SKILL.md"
}
Get-ChildItem (Join-Path $tpl "github/prompts") -Filter "*.prompt.md" | ForEach-Object {
    Install-Managed $_.FullName ".github/prompts/$($_.Name)"
}

# Manifiesto y registro local
$manifest.version = $version
$ordered = [ordered]@{ version = $version; updatedAt = (Get-Date).ToString("s"); files = [ordered]@{} }
foreach ($k in ($manifest.files.Keys | Sort-Object)) { $ordered.files[$k] = $manifest.files[$k] }
$ordered | ConvertTo-Json -Depth 4 | Set-Content $manifestPath -Encoding UTF8
New-Item -ItemType Directory -Force -Path (Join-Path $Destino ".pipeline") | Out-Null
@{ pluginRoot = $pluginRoot; version = $version; projectFilesVersion = $version; initializedAt = (Get-Date).ToString("s") } |
    ConvertTo-Json | Set-Content (Join-Path $Destino ".pipeline/kit.json") -Encoding UTF8

if ($creados)      { Write-Host "`nCreados:" -ForegroundColor Green;  $creados      | ForEach-Object { "  + $_" } }
if ($actualizados) { Write-Host "`nActualizados (gestionados por el kit):" -ForegroundColor Green; $actualizados | ForEach-Object { "  ^ $_" } }
if ($fusionados)   { Write-Host "`nFusionados:" -ForegroundColor Green; $fusionados   | ForEach-Object { "  ~ $_" } }
if ($conservados)  { Write-Host "`nYa existían (NO se tocaron; revisa el .kit y fusiona a mano):" -ForegroundColor Yellow; $conservados | ForEach-Object { "  = $_" } }
if ($modificados)  { Write-Host "`nGestionados por el kit pero modificados por ti (NO se tocaron):" -ForegroundColor Yellow; $modificados | ForEach-Object { "  ! $_" } }
if (-not ($creados -or $actualizados -or $fusionados -or $conservados -or $modificados)) { Write-Host "`nTodo al día (v$version)." -ForegroundColor Green }

if (-not $Update) {
    Write-Host "`nSiguiente:" -ForegroundColor Cyan
    Write-Host "  1. Edita pipeline.config.ps1 (build/test/lint, proveedor de staging)"
    Write-Host "  2. Edita AGENTS.md con la descripción de tu proyecto"
    Write-Host "  3. .\kit.ps1 check      (verifica herramientas)"
    Write-Host "  4. copilot  ->  /pipeline `"tu idea`"     (o en VS Code: /pipeline)"
    Write-Host "  5. Haz commit de .github/ y kit.ps1 para que el equipo y el cloud agent usen lo mismo"
}
