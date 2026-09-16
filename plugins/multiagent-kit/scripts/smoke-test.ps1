# Pruebas de humo contra staging. Uso:  .\kit.ps1 smoke
# Comprueba salud y, si existe, ejecuta $SMOKE_CMD del proyecto. Sin SMOKE_CMD, solo se prueba salud
# y se AVISA: el release-manager debe pedir al proyecto un SMOKE_CMD real, no improvisar pruebas manuales.
. (Join-Path $PSScriptRoot "_common.ps1")

$fallos = 0
function Test-Url($path, $expected = 200) {
    try {
        $r = Invoke-WebRequest "$STAGING_URL$path" -UseBasicParsing -TimeoutSec 8
        if ($r.StatusCode -eq $expected) { Write-Ok "$path -> $($r.StatusCode)" }
        else { Write-Fail "$path -> $($r.StatusCode) (esperado $expected)"; $script:fallos++ }
    } catch { Write-Fail "$path -> sin respuesta ($($_.Exception.Message))"; $script:fallos++ }
}

if ($STAGING_PROVIDER -eq "ninguno") { Write-Warn "STAGING_PROVIDER = ninguno: no hay smoke automatizable."; exit 3 }

Write-Step "Smoke: salud en $STAGING_URL$HEALTH_PATH"
if ($HEALTH_PATH) { Test-Url $HEALTH_PATH }

if ($STAGING_PROVIDER -in @("docker")) {
    Write-Step "Contenedor sin reinicios"
    $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    $restarts = if ($script:IsWin) { cmd /c "docker inspect --format {{.RestartCount}} $APP_NAME-staging 2>nul" } else { sh -c "docker inspect --format {{.RestartCount}} $APP_NAME-staging 2>/dev/null" }
    $ErrorActionPreference = $prev
    if ($restarts -and [int]$restarts -gt 0) { Write-Fail "El contenedor se reinició $restarts veces"; $fallos++ } else { Write-Ok "0 reinicios" }
}

if ([string]::IsNullOrWhiteSpace($SMOKE_CMD)) {
    Write-Warn "SMOKE_CMD vacío: solo se probó la salud. Define en pipeline.config.ps1 un comando de smoke del proyecto (p. ej. un script que llame a los endpoints de la feature)."
} else {
    Write-Step "Smoke del proyecto: $SMOKE_CMD"
    $env:STAGING_URL = $STAGING_URL
    Push-Location $KitRoot
    try { $code = Invoke-Native $SMOKE_CMD $true; if ($code -ne 0) { Write-Fail "SMOKE_CMD terminó con código $code"; $fallos++ } else { Write-Ok "SMOKE_CMD" } }
    finally { Pop-Location }
}

if ($fallos -eq 0) {
    Write-Host "`nSMOKE TESTS: PASARON" -ForegroundColor Green
    Set-PipelineState @{ smoke_ok = $true }
} else {
    Write-Host "`nSMOKE TESTS: $fallos FALLO(S)" -ForegroundColor Red
    Set-PipelineState @{ smoke_ok = $false }
    exit 1
}
