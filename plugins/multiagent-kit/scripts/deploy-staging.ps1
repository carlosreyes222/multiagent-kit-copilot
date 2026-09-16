# Despliega a STAGING según $STAGING_PROVIDER de pipeline.config.ps1.
# Uso:  .\kit.ps1 staging -Feature "nombre-de-la-feature"
param([string]$Feature = "")
. (Join-Path $PSScriptRoot "_common.ps1")

if (-not $Feature) { $Feature = (Get-CurrentBranch) -replace '^(feature|fix)/', '' }
if (-not $STAGING_PROVIDER) { $STAGING_PROVIDER = "docker" }
Write-Step "Desplegando a STAGING la feature '$Feature' (proveedor: $STAGING_PROVIDER)"
Set-PipelineState @{ feature = $Feature; staging_ok = $false; smoke_ok = $false; stage = "staging" }

if ($STAGING_PROVIDER -ne "ninguno") {
    Invoke-ProjectCmd "Instalar dependencias" $INSTALL_CMD
    Invoke-ProjectCmd "Lint"                  $LINT_CMD
    Invoke-ProjectCmd "Build"                 $BUILD_CMD
    Invoke-ProjectCmd "Tests"                 $TEST_CMD
}

function Wait-Healthy([string]$url, [int]$seconds = 60) {
    Write-Step "Esperando a que $url responda 200 (máx. $seconds s)"
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { return $true }
        } catch { Start-Sleep -Seconds 2 }
    }
    return $false
}

function Assert-EnvFile {
    if ($STAGING_ENV_FILE -and -not (Test-Path (Join-Path $KitRoot $STAGING_ENV_FILE))) {
        throw "Falta $STAGING_ENV_FILE. Créalo (sin secretos de producción) antes de desplegar."
    }
}

function Test-PortFree([int]$port) {
    try { $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; return (-not $c) } catch { return $true }
}

$ok = $false
switch ($STAGING_PROVIDER) {

    "docker" {
        Assert-EnvFile
        if (-not (Test-PortFree $STAGING_PORT)) { throw "El puerto $STAGING_PORT ya está en uso en esta máquina. Cambia STAGING_PORT en pipeline.config.ps1." }
        $env:APP_NAME = $APP_NAME; $env:STAGING_PORT = $STAGING_PORT
        $env:BASE_IMAGE = $BASE_IMAGE; $env:CONTAINER_CMD = $CONTAINER_CMD
        $envf = Join-Path $KitRoot $STAGING_ENV_FILE
        Push-Location (Join-Path $KitRoot "staging")
        try {
            Write-Step "docker compose up (staging/docker-compose.staging.yml)"
            Invoke-Native "docker compose --env-file `"$envf`" -f docker-compose.staging.yml down --remove-orphans" $true | Out-Null
            Invoke-Native "docker compose --env-file `"$envf`" -f docker-compose.staging.yml up -d --build" | Out-Null
        } finally { Pop-Location }
        $ok = Wait-Healthy "$STAGING_URL$HEALTH_PATH"
        if (-not $ok) { Write-Warn "Logs: docker compose -f staging/docker-compose.staging.yml logs --tail 100" }
    }

    "compose" {
        Assert-EnvFile
        $cf = Join-Path $KitRoot $STAGING_COMPOSE_FILE
        if (-not (Test-Path $cf)) { throw "No existe $STAGING_COMPOSE_FILE" }
        $envf = Join-Path $KitRoot $STAGING_ENV_FILE
        Write-Step "docker compose up ($STAGING_COMPOSE_FILE)"
        Invoke-Native "docker compose --env-file `"$envf`" -f `"$cf`" down --remove-orphans" $true | Out-Null
        Invoke-Native "docker compose --env-file `"$envf`" -f `"$cf`" up -d --build" | Out-Null
        $ok = Wait-Healthy "$STAGING_URL$HEALTH_PATH"
        if (-not $ok) { Write-Warn "Logs: docker compose -f $STAGING_COMPOSE_FILE logs --tail 100" }
    }

    "supabase" {
        if (-not $SUPABASE_STAGING_REF) { throw "SUPABASE_STAGING_REF vacío. Crea un proyecto Supabase de staging y pon su ref en pipeline.config.ps1 (ver docs/10-supabase.md)." }
        if ($SUPABASE_STAGING_REF -eq $SUPABASE_PROD_REF) { throw "SUPABASE_STAGING_REF es igual a SUPABASE_PROD_REF: staging nunca apunta a producción." }
        $ok = Invoke-SupabaseDeploy -ProjectRef $SUPABASE_STAGING_REF -Label "STAGING"
        if ($ok -and $STAGING_URL -and $HEALTH_PATH) { $ok = Wait-Healthy "$STAGING_URL$HEALTH_PATH" 30 }
    }

    "comando" {
        if (-not $STAGING_DEPLOY_CMD) { throw "STAGING_DEPLOY_CMD vacío para el proveedor 'comando'." }
        Invoke-ProjectCmd "Despliegue a staging" $STAGING_DEPLOY_CMD
        if ($STAGING_URL -and $HEALTH_PATH) { $ok = Wait-Healthy "$STAGING_URL$HEALTH_PATH" } else { $ok = $true }
    }

    "ninguno" {
        Write-Warn "STAGING_PROVIDER = ninguno: no hay staging automatizable. El release-manager debe documentar la verificación manual en el informe de release."
        Set-PipelineState @{ staging_at = (Get-Date).ToString("s") }
        exit 3
    }

    default { throw "STAGING_PROVIDER desconocido: $STAGING_PROVIDER (docker|compose|supabase|comando|ninguno)" }
}

if ($ok) {
    Write-Ok "Staging listo en $STAGING_URL"
    Set-PipelineState @{ staging_ok = $true; staging_at = (Get-Date).ToString("s") }
} else {
    Write-Fail "Staging no respondió 200 en $STAGING_URL$HEALTH_PATH"
    Set-PipelineState @{ staging_ok = $false; staging_at = (Get-Date).ToString("s") }
    exit 1
}
