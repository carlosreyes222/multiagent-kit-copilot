# Hook preToolUse: antes de cada 'git commit' corre lint + tests del proyecto.
# Si fallan, bloquea el commit y devuelve el error al agente para que lo corrija.
# Se desactiva con $GATE_TESTS_ON_COMMIT = $false en pipeline.config.ps1
# o temporalmente con la variable de entorno PIPELINE_SKIP_GATE=1.
$ErrorActionPreference = "SilentlyContinue"
. (Join-Path $PSScriptRoot "_hook-common.ps1")

$evt = Read-HookEvent
$a = Get-HookAction $evt
if ($a.Tool -ne "bash" -or $a.Command -notmatch "git\s+commit\b") { exit 0 }
$root = Find-KitRoot $a.Cwd
if (-not $root) { exit 0 }
$GATE_TESTS_ON_COMMIT = $true; $LINT_CMD = ""; $TEST_CMD = ""
. (Join-Path $root "pipeline.config.ps1")
if (-not $GATE_TESTS_ON_COMMIT -or $env:PIPELINE_SKIP_GATE -eq "1") { exit 0 }

Write-Output '{"type": "progress", "message": "Kit: compuerta de commit (lint + tests)..."}'
foreach ($pair in @(@("Lint", $LINT_CMD), @("Tests", $TEST_CMD))) {
    $label, $c = $pair
    if ([string]::IsNullOrWhiteSpace($c)) { continue }
    $r = Invoke-ShellCapture $c $root
    if ($r.Code -ne 0) {
        $tail = ($r.Output | Select-Object -Last 40) -join "`n"
        Deny-Action "COMMIT BLOQUEADO: $label falló ($c). Últimas líneas:`n$tail"
    }
}
exit 0
