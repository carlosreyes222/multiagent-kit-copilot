# Verifica que el equipo tiene todo lo necesario para el flujo multiagente con GitHub Copilot.
# Uso:  .\kit.ps1 check
. (Join-Path $PSScriptRoot "_common.ps1")

$ok = $true
function Check($name, $cmd, $hint) {
    try {
        $v = & $cmd 2>&1 | Select-Object -First 1
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "code $LASTEXITCODE" }
        Write-Ok "$name : $v"
    } catch {
        Write-Fail "$name no encontrado. $hint"
        $script:ok = $false
    }
}

Write-Step "Herramientas base"
Check "Git"          { git --version }     "Instala: winget install Git.Git"
Check "Node.js"      { node --version }    "Instala: winget install OpenJS.NodeJS.LTS"
Check "Copilot CLI"  { copilot --version } "Instala: npm install -g @github/copilot   (luego 'copilot' y /login)"
if ($STAGING_PROVIDER -in @("docker","compose")) {
    Check "Docker" { docker --version } "Instala Docker Desktop: winget install Docker.DockerDesktop"
}

Write-Step "PowerShell 7 (obligatorio para los hooks de Copilot)"
if ($PSVersionTable.PSVersion.Major -ge 7) { Write-Ok "PowerShell $($PSVersionTable.PSVersion)" }
else { Write-Fail "Estás en Windows PowerShell $($PSVersionTable.PSVersion). Los hooks de Copilot requieren PowerShell 7: winget install Microsoft.PowerShell (y usa 'pwsh')."; $ok = $false }

Write-Step "Plugin y archivos del proyecto"
$mf = Join-Path $KitRoot ".github/kit-manifest.json"
$pv = (Get-Content (Join-Path $PluginRoot "plugin.json") -Raw | ConvertFrom-Json).version
if (Test-Path $mf) {
    $fv = (Get-Content $mf -Raw | ConvertFrom-Json).version
    if ($fv -eq $pv) { Write-Ok "Plugin v$pv y archivos del proyecto v$fv" } else { Write-Warn "Plugin v$pv pero archivos del proyecto v${fv}: ejecuta .\kit.ps1 update" }
} else { Write-Warn "Falta .github/kit-manifest.json: ejecuta .\kit.ps1 init" }
foreach ($f in @(".github/hooks/kit.json", ".github/agents/director.agent.md", ".github/skills/pipeline/SKILL.md", "AGENTS.md")) {
    if (Test-Path (Join-Path $KitRoot $f)) { Write-Ok $f } else { Write-Warn "Falta $f (kit.ps1 init)" }
}

if ($STAGING_PROVIDER -eq "supabase") {
    Write-Step "Supabase CLI (proveedor de staging = supabase)"
    Check "Supabase CLI" { supabase --version } "Instala: winget install Supabase.cli  (o scoop install supabase)"
    if (-not $SUPABASE_STAGING_REF -or -not $SUPABASE_PROD_REF) { Write-Fail "SUPABASE_STAGING_REF / SUPABASE_PROD_REF vacíos en pipeline.config.ps1 (ver docs/10-supabase.md)"; $ok = $false }
    elseif ($SUPABASE_STAGING_REF -eq $SUPABASE_PROD_REF) { Write-Fail "Staging y producción apuntan al mismo proyecto Supabase"; $ok = $false }
}

if ($STAGING_PROVIDER -in @("docker","compose")) {
    Write-Step "Docker en ejecución"
    $code = Invoke-Native "docker info" $true
    if ($code -eq 0) { Write-Ok "Docker responde" } else { Write-Fail "Docker no está corriendo. Abre Docker Desktop y espera a que diga 'Engine running'."; $ok = $false }
} else { Write-Warn "Proveedor de staging '$STAGING_PROVIDER': Docker no es necesario." }

Write-Step "Configuración del proyecto"
if ([string]::IsNullOrWhiteSpace($TEST_CMD)) { Write-Warn "TEST_CMD está vacío en pipeline.config.ps1 — el agente tester no podrá correr pruebas." }
if ([string]::IsNullOrWhiteSpace($PROD_DEPLOY_CMD) -and $STAGING_PROVIDER -ne "supabase") { Write-Warn "PROD_DEPLOY_CMD está vacío — kit.ps1 prod solo simulará el despliegue." }
if ([string]::IsNullOrWhiteSpace($SMOKE_CMD)) { Write-Warn "SMOKE_CMD está vacío — el smoke solo probará la salud; define un comando de smoke del proyecto." }
$over = Test-DocLimits; if ($over) { Write-Warn "Documentos por encima del límite:"; $over | ForEach-Object { Write-Warn "  $_" } }

if ($ok) { Write-Host "`nTodo listo. Abre 'copilot' en la raíz del proyecto y ejecuta /pipeline `"tu idea`" (o /pipeline en VS Code)." -ForegroundColor Green }
else     { Write-Host "`nFaltan herramientas. Revisa los mensajes [XX] arriba." -ForegroundColor Red; exit 1 }
