# Hook preToolUse: impide que cualquier agente haga commit, push o merge directo a ramas protegidas,
# promueva a producción, ejecute comandos destructivos o toque secretos.
# Recibe el JSON del evento por stdin (formato CLI camelCase o VS Code/PascalCase). Deniega con JSON + exit 2.
$ErrorActionPreference = "SilentlyContinue"
. (Join-Path $PSScriptRoot "_hook-common.ps1")

$evt = Read-HookEvent
$a = Get-HookAction $evt
$root = Find-KitRoot $a.Cwd
# Solo actúa en proyectos inicializados con el kit
if (-not $root) { exit 0 }
$PROTECTED_BRANCHES = @("main", "master")
. (Join-Path $root "pipeline.config.ps1")
$protectedRe = ($PROTECTED_BRANCHES | ForEach-Object { [regex]::Escape($_) }) -join "|"

# --- Secretos: ningún agente lee ni edita .env reales ni keystores ---
if ($a.Tool -in @("read", "edit") -and $a.Path) {
    $p = $a.Path -replace "\\", "/"
    if ($p -match "(^|/)\.env(\.[^/]+)?$" -and $p -notmatch "\.example$" -and $p -notmatch "/staging/\.env\.staging$") {
        Deny-Action "los agentes no leen ni editan archivos .env ($p). Usa variables de entorno o el .env.example."
    }
    if ($p -match "\.(jks|keystore|p12|pem|pfx)$" -or $p -match "(^|/)google-services\.json$") {
        Deny-Action "archivo sensible ($p): los agentes no lo leen ni lo modifican."
    }
}

if ($a.Tool -ne "bash" -or -not $a.Command) { exit 0 }
$cmd = $a.Command
$branch = Get-GitBranch $root

# 1) Producción: solo una persona desde su terminal
if ($cmd -match "kit\.ps1\s+prod\b" -or $cmd -match "promote-prod\.ps1") {
    Deny-Action "la promoción a producción ('kit.ps1 prod') solo la ejecuta una persona desde su terminal."
}
if ($cmd -match "supabase\s+(db\s+push|functions\s+deploy|db\s+reset)\b") {
    Deny-Action "despliegues a Supabase solo a través de 'kit.ps1 staging' (staging) o 'kit.ps1 prod' (persona)."
}
# 2) Comandos destructivos
if ($cmd -match "git\s+push\b.*(--force\b|\s-f\b|--force-with-lease)" -or $cmd -match "git\s+reset\s+--hard" -or
    $cmd -match "\brm\s+-rf\b" -or $cmd -match "Remove-Item\b.*-Recurse" -or $cmd -match "docker\s+system\s+prune" -or
    $cmd -match "docker\s+volume\s+rm" -or $cmd -match "docker\s+compose\b.*\bdown\b.*(\s-v\b|--volumes)") {
    Deny-Action "comando destructivo no permitido a los agentes: $cmd"
}
# 3) push directo a rama protegida
if ($cmd -match "git\s+push\b.*\b($protectedRe)\b" -or ($cmd -match "git\s+push\b" -and $branch -match "^($protectedRe)$")) {
    Deny-Action "no se permite 'git push' a ramas protegidas ($($PROTECTED_BRANCHES -join ', ')). Abre un PR desde una rama feature/*."
}
# 4) commit estando parado en rama protegida
if ($cmd -match "git\s+commit\b" -and $branch -match "^($protectedRe)$") {
    Deny-Action "estás en '$branch'. Crea una rama: git checkout -b feature/<nombre>"
}
# 5) merge a rama protegida sin veredicto de seguridad APROBADO
if ($cmd -match "git\s+merge\b" -and $branch -match "^($protectedRe)$") {
    $state = Join-Path $root ".pipeline/state.json"
    $feature = ""
    if (Test-Path $state) { $feature = (Get-Content $state -Raw | ConvertFrom-Json).feature }
    $rev = Join-Path $root "docs/reviews/$feature-seguridad.md"
    $ok = (Test-Path $rev) -and ((Get-Content $rev -Raw) -match "(?m)^\s*VEREDICTO:\s*APROBADO")
    if (-not $ok) { Deny-Action "merge a '$branch' requiere 'VEREDICTO: APROBADO' en docs/reviews/$feature-seguridad.md" }
}
exit 0
