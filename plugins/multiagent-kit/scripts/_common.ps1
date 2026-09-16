# Funciones compartidas por todos los scripts del kit. Compatible con Windows PowerShell 5.1 y PowerShell 7.
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new() } catch {}

# Raíz del PROYECTO (no del plugin): la fija kit.ps1, o se busca hacia arriba.
function Find-ProjectRoot {
    foreach ($c in @($env:KIT_PROJECT_DIR)) {
        if ($c -and (Test-Path (Join-Path $c "pipeline.config.ps1"))) { return $c }
    }
    $d = (Get-Location).Path
    while ($d) {
        if (Test-Path (Join-Path $d "pipeline.config.ps1")) { return $d }
        $parent = Split-Path $d -Parent
        if ($parent -eq $d) { break }
        $d = $parent
    }
    throw "No encuentro pipeline.config.ps1. Ejecuta esto desde la raíz de un proyecto inicializado (.\kit.ps1 init)."
}
$script:KitRoot = Find-ProjectRoot
$script:PluginRoot = Split-Path -Parent $PSScriptRoot

# Valores por defecto de variables nuevas (para proyectos con un pipeline.config.ps1 antiguo)
$STAGING_PROVIDER = "docker"; $STAGING_URL = ""; $SMOKE_CMD = ""; $STAGING_ENV_FILE = "staging/.env.staging"
$STAGING_COMPOSE_FILE = "staging/docker-compose.staging.yml"; $STAGING_DEPLOY_CMD = ""; $TEST_DB_CMD = ""
$SUPABASE_STAGING_REF = ""; $SUPABASE_PROD_REF = ""; $SUPABASE_DIR = "."; $SUPABASE_FUNCTIONS = @(); $SUPABASE_NO_VERIFY_JWT = $true
$SUB_REPOS = @(); $MAX_LINES_ARQUITECTURA = 300; $MAX_LINES_INFORME = 100; $MAX_LINES_ADR = 150
. (Join-Path $script:KitRoot "pipeline.config.ps1")
if (-not $STAGING_URL -and $STAGING_PORT -and $STAGING_PROVIDER -in @("docker","compose")) { $STAGING_URL = "http://localhost:$STAGING_PORT" }

$script:StateFile = Join-Path $script:KitRoot ".pipeline/state.json"

function Write-Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host "    [XX] $msg" -ForegroundColor Red }

$script:IsWin = ($env:OS -eq "Windows_NT")
# Ejecuta un comando nativo en el shell del sistema (cmd en Windows, sh en macOS/Linux) sin que
# PowerShell 5.1 convierta stderr en excepción. $ignoreFailure = $true -> no lanza si el código de salida es distinto de 0.
function Invoke-Native([string]$cmdline, [bool]$ignoreFailure = $false) {
    $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    try {
        if ($script:IsWin) { cmd /c "$cmdline 2>&1" | ForEach-Object { Write-Host "    $_" } }
        else { sh -c "$cmdline 2>&1" | ForEach-Object { Write-Host "    $_" } }
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $prev }
    if ($code -ne 0 -and -not $ignoreFailure) { throw "Falló ($code): $cmdline" }
    return $code
}

function Invoke-ProjectCmd([string]$label, [string]$cmd) {
    if ([string]::IsNullOrWhiteSpace($cmd)) { Write-Warn "$label omitido (vacío en pipeline.config.ps1)"; return }
    Write-Step "$label : $cmd"
    Push-Location $script:KitRoot
    try { Invoke-Native $cmd | Out-Null; Write-Ok $label } finally { Pop-Location }
}

function Get-PipelineState {
    if (Test-Path $script:StateFile) { return Get-Content $script:StateFile -Raw | ConvertFrom-Json }
    return [pscustomobject]@{ schema_version = 2; feature = ""; type = "feature"; stage = ""; qa = "PENDIENTE"; codigo = "PENDIENTE"; seguridad = "PENDIENTE"; staging_ok = $false; smoke_ok = $false; staging_at = "" }
}

function Set-PipelineState([hashtable]$changes) {
    $s = Get-PipelineState
    foreach ($k in $changes.Keys) { $s | Add-Member -NotePropertyName $k -NotePropertyValue $changes[$k] -Force }
    New-Item -ItemType Directory -Force -Path (Split-Path $script:StateFile) | Out-Null
    $s | ConvertTo-Json | Set-Content $script:StateFile -Encoding UTF8
}

function Get-CurrentBranch {
    $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    try {
        if ($script:IsWin) { $b = (cmd /c "git rev-parse --abbrev-ref HEAD 2>nul") } else { $b = (sh -c "git rev-parse --abbrev-ref HEAD 2>/dev/null") }
    } finally { $ErrorActionPreference = $prev }
    if ($b) { return ([string]$b).Trim() } else { return "" }
}

function Get-SecurityVerdict([string]$feature) {
    if (-not $feature) { return "PENDIENTE" }
    $f = Join-Path $script:KitRoot "docs/reviews/$feature-seguridad.md"
    if (-not (Test-Path $f)) { return "PENDIENTE" }
    $txt = Get-Content $f -Raw
    if ($txt -match "(?m)^\s*VEREDICTO:\s*APROBADO")  { return "APROBADO" }
    if ($txt -match "(?m)^\s*VEREDICTO:\s*RECHAZADO") { return "RECHAZADO" }
    return "PENDIENTE"
}

# Supabase: db push + functions deploy contra un proyecto (ref). Nunca por navegador.
function Invoke-SupabaseDeploy([string]$ProjectRef, [string]$Label) {
    $dir = Join-Path $script:KitRoot $SUPABASE_DIR
    if (-not (Test-Path (Join-Path $dir "supabase"))) { throw "No existe $SUPABASE_DIR/supabase. Ajusta SUPABASE_DIR en pipeline.config.ps1." }
    Write-Step "Supabase ($Label): proyecto $ProjectRef"
    Push-Location $dir
    try {
        Invoke-Native "supabase --version" | Out-Null
        Invoke-Native "supabase link --project-ref $ProjectRef" | Out-Null
        Write-Step "Migraciones: supabase db push"
        Invoke-Native "supabase db push" | Out-Null
        $fns = @($SUPABASE_FUNCTIONS)
        if ($fns.Count -eq 0 -and (Test-Path "supabase\functions")) {
            $fns = Get-ChildItem "supabase\functions" -Directory | Where-Object { $_.Name -notlike "_*" } | ForEach-Object { $_.Name }
        }
        foreach ($fn in $fns) {
            $flag = if ($SUPABASE_NO_VERIFY_JWT) { "--no-verify-jwt" } else { "" }
            Write-Step "Edge Function: $fn"
            Invoke-Native "supabase functions deploy $fn $flag --project-ref $ProjectRef" | Out-Null
        }
        Write-Ok "Supabase ($Label) desplegado: migraciones + $($fns.Count) funciones"
        return $true
    } catch {
        Write-Fail $_.Exception.Message
        return $false
    } finally { Pop-Location }
}

# Aviso de documentos demasiado largos (los agentes deben respetar los límites de pipeline.config.ps1)
function Test-DocLimits {
    $checks = @(
        @{ p = "docs/ARQUITECTURA.md"; max = $MAX_LINES_ARQUITECTURA },
        @{ p = "docs/arquitectura.md"; max = $MAX_LINES_ARQUITECTURA }
    )
    foreach ($f in Get-ChildItem (Join-Path $script:KitRoot "docs/reviews") -Filter "*.md" -ErrorAction SilentlyContinue) { $checks += @{ p = "docs/reviews/$($f.Name)"; max = $MAX_LINES_INFORME } }
    foreach ($f in Get-ChildItem (Join-Path $script:KitRoot "docs/adr") -Filter "*.md" -ErrorAction SilentlyContinue) { $checks += @{ p = "docs/adr/$($f.Name)"; max = $MAX_LINES_ADR } }
    $over = @()
    foreach ($c in $checks) {
        $full = Join-Path $script:KitRoot $c.p
        if ((Test-Path $full) -and $c.p -notmatch "_PLANTILLA") {
            $n = (Get-Content $full).Count
            if ($n -gt $c.max) { $over += "$($c.p): $n líneas (máx. $($c.max))" }
        }
    }
    return $over
}
