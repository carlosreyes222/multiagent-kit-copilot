# Promueve a PRODUCCIÓN. Última compuerta del pipeline. Exige:
#   1) staging desplegado y smoke tests pasados (.pipeline/state.json)
#   2) VEREDICTO: APROBADO del revisor de seguridad (docs/reviews/<feature>-seguridad.md)
#   3) confirmación humana escrita (o -Yes desde una persona en CI)
# Uso:  .\kit.ps1 prod        |   .\kit.ps1 prod -Yes
param([switch]$Yes)
. (Join-Path $PSScriptRoot "_common.ps1")

$s = Get-PipelineState
Write-Step "Verificando compuertas para la feature '$($s.feature)'"

$bloqueos = @()
if (-not $s.feature)    { $bloqueos += "No hay feature en .pipeline/state.json (corre .\kit.ps1 staging -Feature <slug>)." }
if (-not $s.staging_ok) { $bloqueos += "Staging no está desplegado correctamente (corre .\kit.ps1 staging)." }
if (-not $s.smoke_ok)   { $bloqueos += "Smoke tests no han pasado (corre .\kit.ps1 smoke)." }
$veredicto = Get-SecurityVerdict ([string]$s.feature)
if ($veredicto -ne "APROBADO") { $bloqueos += "Revisión de seguridad: $veredicto (se requiere APROBADO en docs/reviews/$($s.feature)-seguridad.md)." }

if ($bloqueos.Count -gt 0) {
    foreach ($b in $bloqueos) { Write-Fail $b }
    Write-Host "`nPROMOCIÓN BLOQUEADA." -ForegroundColor Red
    exit 2
}
Write-Ok "Staging OK, smoke OK, seguridad APROBADO"

$over = Test-DocLimits
if ($over) { Write-Warn "Documentos por encima del límite (no bloquea, pero pide al arquitecto que los resuma):"; $over | ForEach-Object { Write-Warn "  $_" } }

if (-not $Yes) {
    Write-Host ""
    $resp = Read-Host "Escribe PRODUCCION para confirmar el despliegue de '$($s.feature)'"
    if ($resp -ne "PRODUCCION") { Write-Warn "Cancelado por el usuario."; exit 1 }
}

if (-not [string]::IsNullOrWhiteSpace($PROD_DEPLOY_CMD)) {
    Invoke-ProjectCmd "Despliegue a producción" $PROD_DEPLOY_CMD
} elseif ($STAGING_PROVIDER -eq "supabase") {
    if (-not $SUPABASE_PROD_REF) { Write-Fail "SUPABASE_PROD_REF vacío."; exit 1 }
    if (-not (Invoke-SupabaseDeploy -ProjectRef $SUPABASE_PROD_REF -Label "PRODUCCIÓN")) { Write-Fail "Falló el despliegue a Supabase producción."; exit 1 }
} else {
    Write-Warn "PROD_DEPLOY_CMD vacío: simulando despliegue (dry-run)."
}

$tag = "prod-$(Get-Date -Format 'yyyyMMdd-HHmm')-$($s.feature)"
Invoke-Native "git tag $tag" $true | Out-Null
Write-Ok "Etiqueta creada: $tag"
Set-PipelineState @{ promoted_at = (Get-Date).ToString("s"); promoted_tag = $tag }
Write-Host "`nPRODUCCIÓN ACTUALIZADA." -ForegroundColor Green
