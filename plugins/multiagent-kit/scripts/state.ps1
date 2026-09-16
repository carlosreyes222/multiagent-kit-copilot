# Estado del pipeline con esquema fijo. Único punto de escritura de .pipeline/state.json.
#   .\kit.ps1 status                          -> muestra el estado
#   .\kit.ps1 state stage=qa qa=APROBADO      -> actualiza claves (ver esquema abajo)
param([switch]$Show, [string[]]$Set)
. (Join-Path $PSScriptRoot "_common.ps1")

# Esquema (schema_version 2). Claves permitidas y valores esperados:
#   feature (slug) · type (feature|bugfix) · mode (nuevo|existente) · stage (spec|arquitectura|implementacion|qa|revisiones|staging|documentacion|entrega|reproducir|corregir)
#   qa / codigo / seguridad (PENDIENTE|APROBADO|RECHAZADO) · qa_iter / codigo_iter (entero)
#   staging_ok / smoke_ok (true|false) · staging_at · promoted_at · promoted_tag · started_at
$allowed = @("feature","type","mode","stage","qa","codigo","seguridad","qa_iter","codigo_iter","staging_ok","smoke_ok","staging_at","promoted_at","promoted_tag","started_at")

$s = Get-PipelineState
if (-not $s.PSObject.Properties["schema_version"]) { $s | Add-Member -NotePropertyName schema_version -NotePropertyValue 2 -Force }

if ($Set) {
    $changes = @{}
    foreach ($kv in $Set) {
        if ($kv -notmatch '^([a-z_]+)=(.*)$') { Write-Fail "Formato inválido: '$kv' (usa clave=valor)"; exit 1 }
        $k = $Matches[1]; $v = $Matches[2]
        if ($allowed -notcontains $k) { Write-Fail "Clave no permitida: $k. Permitidas: $($allowed -join ', ')"; exit 1 }
        if ($v -in @("true","false")) { $v = [bool]::Parse($v) }
        elseif ($v -match '^\d+$') { $v = [int]$v }
        $changes[$k] = $v
    }
    if (-not $s.started_at) { $changes["started_at"] = (Get-Date).ToString("s") }
    Set-PipelineState $changes
    $s = Get-PipelineState
    Write-Ok "Estado actualizado: $($changes.Keys -join ', ')"
}

if ($Show -or -not $Set) {
    Write-Step "Estado del pipeline"
    $s | Format-List | Out-String | Write-Host
    $ver = Get-SecurityVerdict ([string]$s.feature)
    Write-Host "Compuertas para producción:" -ForegroundColor Cyan
    Write-Host ("  staging_ok = {0}   smoke_ok = {1}   seguridad = {2}" -f $s.staging_ok, $s.smoke_ok, $ver)
}
