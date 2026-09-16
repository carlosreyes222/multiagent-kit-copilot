# Funciones compartidas por los hooks del kit para GitHub Copilot.
# Acepta los dos formatos de evento que emite Copilot:
#   - camelCase (CLI y cloud agent):  { toolName, toolArgs (cadena JSON), cwd }
#   - PascalCase / VS Code:           { tool_name, tool_input (objeto), cwd, hook_event_name }
# Funciona en Windows PowerShell 5.1 y PowerShell 7 (Windows, macOS y Linux).
try { [Console]::InputEncoding = [System.Text.UTF8Encoding]::new(); [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new() } catch {}

function Read-HookEvent {
    $raw = ""
    try { $raw = [Console]::In.ReadToEnd() } catch {}
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    try { return ($raw | ConvertFrom-Json) } catch { return $null }
}

# Normaliza el evento a: @{ Tool = "bash|read|edit|other"; Command = "..."; Path = "..."; Cwd = "..." }
function Get-HookAction($evt) {
    $r = @{ Tool = "other"; Command = ""; Path = ""; Cwd = "" }
    if (-not $evt) { return $r }
    $name = ""; $args = $null
    if ($evt.PSObject.Properties["toolName"]) {
        $name = [string]$evt.toolName
        $args = $evt.toolArgs
        if ($args -is [string]) { try { $args = $args | ConvertFrom-Json } catch { $args = $null } }
    } elseif ($evt.PSObject.Properties["tool_name"]) {
        $name = [string]$evt.tool_name
        $args = $evt.tool_input
        if ($args -is [string]) { try { $args = $args | ConvertFrom-Json } catch { $args = $null } }
    }
    if ($evt.PSObject.Properties["cwd"]) { $r.Cwd = [string]$evt.cwd }
    $n = $name.ToLowerInvariant()
    if ($n -in @("bash", "powershell", "shell", "execute", "runinterminal", "run_in_terminal")) { $r.Tool = "bash" }
    elseif ($n -in @("view", "read", "readfile", "read_file", "cat")) { $r.Tool = "read" }
    elseif ($n -in @("edit", "create", "write", "str_replace_editor", "apply_patch", "multiedit", "editfile", "createfile", "edit_file", "create_file")) { $r.Tool = "edit" }
    if ($args) {
        foreach ($k in @("command", "commandLine", "cmd", "script")) {
            if ($args.PSObject.Properties[$k] -and $args.$k) { $r.Command = [string]$args.$k; break }
        }
        foreach ($k in @("file_path", "filePath", "path", "file", "target_file", "targetFile")) {
            if ($args.PSObject.Properties[$k] -and $args.$k) { $r.Path = [string]$args.$k; break }
        }
    }
    return $r
}

function Find-KitRoot($startDir) {
    foreach ($c in @($env:KIT_PROJECT_DIR, $startDir, (Get-Location).Path)) {
        $d = $c
        while ($d) {
            if (Test-Path (Join-Path $d "pipeline.config.ps1")) { return $d }
            $parent = Split-Path $d -Parent
            if (-not $parent -or $parent -eq $d) { break }
            $d = $parent
        }
    }
    return $null
}

# Bloquea la acción: JSON para la CLI de Copilot, stderr + exit 2 para VS Code y formato Claude.
function Deny-Action([string]$reason) {
    $json = @{ permissionDecision = "deny"; permissionDecisionReason = $reason } | ConvertTo-Json -Compress
    Write-Output $json
    [Console]::Error.WriteLine("BLOQUEADO: $reason")
    exit 2
}

function Get-GitBranch([string]$root) {
    try {
        $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
        $out = & git -C $root rev-parse --abbrev-ref HEAD 2>&1
        $code = $LASTEXITCODE
        $ErrorActionPreference = $prev
        $b = ($out | Select-Object -First 1)
        if ($code -eq 0 -and $b -and "$b" -ne "HEAD") { return ([string]$b).Trim() }
    } catch {}
    return ""
}

# Ejecuta un comando del proyecto en el shell nativo del sistema y devuelve @{ Code; Output }.
function Invoke-ShellCapture([string]$cmdline, [string]$workdir) {
    $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    Push-Location $workdir
    try {
        if ($IsWindows -or $env:OS -eq "Windows_NT") { $out = cmd /c "$cmdline 2>&1" }
        else { $out = sh -c "$cmdline 2>&1" }
        $code = $LASTEXITCODE
    } finally { Pop-Location; $ErrorActionPreference = $prev }
    return @{ Code = $code; Output = $out }
}
