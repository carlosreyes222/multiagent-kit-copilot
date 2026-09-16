# Lanzador de los scripts del kit multiagente para GitHub Copilot, desde la raíz del proyecto.
# Los scripts viven en el plugin instalado (~/.copilot/installed-plugins) y se actualizan con él; este archivo solo los localiza.
#   .\kit.ps1 check                      -> verifica herramientas
#   .\kit.ps1 staging [-Feature slug]    -> despliega a staging (proveedor según pipeline.config.ps1)
#   .\kit.ps1 smoke                      -> smoke tests contra staging
#   .\kit.ps1 prod [-Yes]                -> promover a producción (pide confirmación)
#   .\kit.ps1 status                     -> estado del pipeline (.pipeline/state.json)
#   .\kit.ps1 state clave=valor ...      -> actualizar el estado (lo usan los agentes)
#   .\kit.ps1 init                       -> (re)inicializa archivos del proyecto sin sobrescribir los tuyos
#   .\kit.ps1 update                     -> refresca los archivos gestionados por el kit (.github/agents, skills, prompts, hooks)
#   .\kit.ps1 hook <nombre>              -> (lo usan los hooks de Copilot) reenvía el evento al script del plugin
#   .\kit.ps1 version                    -> versión del plugin y de los archivos del proyecto
param(
    [Parameter(Position = 0)][string]$Comando = "help",
    [string]$Feature = "",
    [switch]$Yes,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Resto
)
$ErrorActionPreference = "Stop"

function Test-PluginDir([string]$r) { return ($r -and (Test-Path (Join-Path $r "scripts")) -and (Test-Path (Join-Path $r "plugin.json"))) }

function Find-PluginRoot {
    if (Test-PluginDir $env:KIT_PLUGIN_ROOT) { return $env:KIT_PLUGIN_ROOT }
    $kitJson = Join-Path $PSScriptRoot ".pipeline/kit.json"
    if (Test-Path $kitJson) {
        try { $r = (Get-Content $kitJson -Raw | ConvertFrom-Json).pluginRoot; if (Test-PluginDir $r) { return $r } } catch {}
    }
    $homes = @()
    if ($env:COPILOT_HOME) { $homes += $env:COPILOT_HOME }
    $homes += (Join-Path $HOME ".copilot")
    foreach ($h in $homes) {
        $base = Join-Path $h "installed-plugins"
        if (-not (Test-Path $base)) { continue }
        $cands = Get-ChildItem $base -Recurse -Depth 3 -Filter "plugin.json" -ErrorAction SilentlyContinue |
            Where-Object { (Split-Path $_.DirectoryName -Leaf) -eq "multiagent-kit" } | Sort-Object LastWriteTime -Descending
        foreach ($c in $cands) { if (Test-PluginDir $c.DirectoryName) { return $c.DirectoryName } }
    }
    return $null
}

$plugin = Find-PluginRoot
$env:KIT_PROJECT_DIR = $PSScriptRoot

if ($Comando -eq "hook") {
    # Los hooks nunca deben romper la sesión si el plugin no está: avisan y permiten.
    $name = if ($Resto) { $Resto[0] } else { "" }
    if (-not $plugin) { [Console]::Error.WriteLine("kit.ps1: plugin multiagent-kit no instalado; hook '$name' omitido."); exit 0 }
    $script = Join-Path $plugin "scripts/$name.ps1"
    if (-not (Test-Path $script)) { [Console]::Error.WriteLine("kit.ps1: hook desconocido '$name'."); exit 0 }
    & $script
    exit $LASTEXITCODE
}
if ($Comando -eq "help") { Get-Content $PSCommandPath | Select-Object -First 13 | ForEach-Object { $_ -replace '^#\s?', '' }; exit 0 }
if (-not $plugin) {
    Write-Host "No encuentro el plugin multiagent-kit. Instálalo:" -ForegroundColor Red
    Write-Host "  copilot plugin marketplace add carlosreyes222/multiagent-kit-copilot"
    Write-Host "  copilot plugin install multiagent-kit@carlos-kits-copilot"
    Write-Host "(o define KIT_PLUGIN_ROOT con la ruta de una copia local del plugin)"
    exit 1
}

$map = @{
    check   = "check-prereqs.ps1"
    staging = "deploy-staging.ps1"
    smoke   = "smoke-test.ps1"
    prod    = "promote-prod.ps1"
    init    = "init-proyecto.ps1"
    update  = "init-proyecto.ps1"
    status  = "state.ps1"
    state   = "state.ps1"
}
switch ($Comando) {
    "version" {
        $pv = (Get-Content (Join-Path $plugin "plugin.json") -Raw | ConvertFrom-Json).version
        $mf = Join-Path $PSScriptRoot ".github/kit-manifest.json"
        $fv = if (Test-Path $mf) { (Get-Content $mf -Raw | ConvertFrom-Json).version } else { "(sin inicializar)" }
        Write-Host "Plugin: $pv  ·  Archivos del proyecto: $fv  ·  $plugin"
        if ($fv -ne $pv -and $fv -ne "(sin inicializar)") { Write-Host "Ejecuta .\kit.ps1 update para refrescar los archivos gestionados." -ForegroundColor Yellow }
        break
    }
    default {
        if (-not $map.ContainsKey($Comando)) { Write-Host "Comando desconocido: $Comando" -ForegroundColor Red; exit 1 }
        # Parámetros con nombre: se reenvían explícitamente (nunca por splatting de array).
        $params = @{}
        if ($Feature) { $params["Feature"] = $Feature }
        if ($Yes)     { $params["Yes"] = $true }
        if ($Comando -eq "status") { $params["Show"] = $true }
        if ($Comando -eq "state" -and $Resto) { $params["Set"] = $Resto }
        if ($Comando -eq "update") { $params["Update"] = $true }
        & (Join-Path $plugin "scripts/$($map[$Comando])") @params
        exit $LASTEXITCODE
    }
}
