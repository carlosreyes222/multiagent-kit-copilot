# Hook sessionStart: registra dónde está instalado el plugin (.pipeline/kit.json), avisa si el
# proyecto tiene una versión antigua de los archivos gestionados y da contexto inicial al agente.
# Salida: JSON { additionalContext } (CLI de Copilot) — VS Code lo muestra como texto.
$ErrorActionPreference = "SilentlyContinue"
. (Join-Path $PSScriptRoot "_hook-common.ps1")

$evt = Read-HookEvent
$a = Get-HookAction $evt
$root = Find-KitRoot $a.Cwd
$pluginRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $pluginRoot "plugin.json") -Raw | ConvertFrom-Json).version

if (-not $root) {
    $msg = "Kit multiagente para Copilot v$version instalado, pero este proyecto no está inicializado. Si el usuario quiere usarlo aquí, ejecuta /kit-init."
} else {
    $dir = Join-Path $root ".pipeline"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $prev = @{}
    $kitJson = Join-Path $dir "kit.json"
    if (Test-Path $kitJson) { try { $prev = Get-Content $kitJson -Raw | ConvertFrom-Json } catch {} }
    $projVersion = ""
    if ($prev -and $prev.PSObject.Properties["projectFilesVersion"]) { $projVersion = [string]$prev.projectFilesVersion }
    @{ pluginRoot = $pluginRoot; version = $version; projectFilesVersion = $projVersion; updatedAt = (Get-Date).ToString("s") } |
        ConvertTo-Json | Set-Content $kitJson -Encoding UTF8
    $prov = ""; try { . (Join-Path $root "pipeline.config.ps1"); $prov = $STAGING_PROVIDER } catch {}
    $msg = "Kit multiagente para Copilot v$version activo. Staging: $prov. Scripts: $pluginRoot/scripts. Comandos: /pipeline, /analisis, /bugfix, /ideas, /deploy-staging, /promote-prod (agente orquestador: director)."
    if ($projVersion -and $projVersion -ne $version) {
        $msg += " AVISO: los archivos de .github/ del proyecto son de la versión $projVersion; ejecuta 'pwsh -File kit.ps1 update' para refrescarlos."
    }
}
Write-Output (@{ additionalContext = $msg } | ConvertTo-Json -Compress)
exit 0
