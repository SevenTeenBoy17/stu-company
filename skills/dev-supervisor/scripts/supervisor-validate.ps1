#requires -Version 5.1
<#
.SYNOPSIS
    Validate a workspace's .codex-supervisor state and print a PASS/FAIL report.

.DESCRIPTION
    Read-only (Tier 1) checks over .codex-supervisor/ledger.json plus optional
    handoff.md and spec.md. Does NOT call git or any native executable, so there
    is no NativeCommandError trap. ASCII-only for Windows PowerShell 5.1 (GBK)
    safety. Exits 1 when any FAIL is recorded, else 0.

.PARAMETER Workspace
    Workspace root to inspect. Defaults to the current working directory.

.NOTES
    Invariant: a task with status 'done' must have verified=true AND non-empty
    evidence; otherwise it is a FAIL naming the offending task id.
#>
[CmdletBinding()]
param(
    [string]$Workspace = (Get-Location).Path
)

Set-StrictMode -Off
$ErrorActionPreference = 'Stop'

# --- result accumulators ---------------------------------------------------
$script:Fails = New-Object System.Collections.ArrayList
$script:Warns = New-Object System.Collections.ArrayList
$script:Oks   = New-Object System.Collections.ArrayList

function Add-Fail { param([string]$Message) [void]$script:Fails.Add($Message) }
function Add-Warn { param([string]$Message) [void]$script:Warns.Add($Message) }
function Add-Ok   { param([string]$Message) [void]$script:Oks.Add($Message) }

function Test-HasProp {
    param([object]$Object, [string]$Name)
    if ($null -eq $Object) { return $false }
    $props = $Object.PSObject.Properties.Name
    return (@($props) -contains $Name)
}

function Test-NonEmpty {
    param([object]$Value)
    if ($null -eq $Value) { return $false }
    if ($Value -is [string]) { return ($Value.Trim().Length -gt 0) }
    if ($Value -is [System.Array]) { return (@($Value).Count -gt 0) }
    if ($Value -is [System.Collections.IEnumerable]) { return (@($Value).Count -gt 0) }
    return $true
}

# --- resolve workspace -----------------------------------------------------
$wsPath = $null
try {
    $wsPath = (Resolve-Path -LiteralPath $Workspace -ErrorAction Stop).Path
} catch {
    Write-Output ("ERROR: workspace path not found: " + $Workspace)
    $global:LASTEXITCODE = 0
    exit 1
}

$stateDir   = Join-Path $wsPath '.codex-supervisor'
$ledgerPath = Join-Path $stateDir 'ledger.json'
$handoffPath = Join-Path $stateDir 'handoff.md'
$specPath   = Join-Path $wsPath 'spec.md'

Write-Output ("Validating supervisor state in: " + $stateDir)
Write-Output ""

# --- check 1: ledger.json exists and is valid JSON -------------------------
$ledger = $null
if (-not (Test-Path -LiteralPath $ledgerPath -PathType Leaf)) {
    Add-Fail ("ledger.json not found at " + $ledgerPath)
} else {
    $raw = $null
    try {
        $raw = Get-Content -LiteralPath $ledgerPath -Raw -Encoding UTF8 -ErrorAction Stop
    } catch {
        Add-Fail ("ledger.json could not be read: " + $_.Exception.Message)
    }
    if ($null -ne $raw) {
        if (-not (Test-NonEmpty $raw)) {
            Add-Fail "ledger.json is empty (torn or unpublished write)."
        } else {
            try {
                $ledger = $raw | ConvertFrom-Json -ErrorAction Stop
                Add-Ok "ledger.json is valid JSON."
            } catch {
                Add-Fail ("ledger.json is not valid JSON: " + $_.Exception.Message)
                $ledger = $null
            }
        }
    }
}

# --- check 2: required top-level fields ------------------------------------
$requiredTop = @('round_id', 'goal', 'tasks', 'decisions', 'risks')
if ($null -ne $ledger) {
    foreach ($field in $requiredTop) {
        if (Test-HasProp -Object $ledger -Name $field) {
            Add-Ok ("ledger has required field: " + $field)
        } else {
            Add-Fail ("ledger missing required field: " + $field)
        }
    }
}

# --- check 3 + 4: per-task shape, status enum, and done invariant ----------
$validStatuses = @('todo', 'doing', 'blocked', 'done')
if (($null -ne $ledger) -and (Test-HasProp -Object $ledger -Name 'tasks')) {
    $tasks = @($ledger.tasks)
    if ($tasks.Count -eq 0) {
        Add-Warn "ledger.tasks is present but empty."
    }
    $index = 0
    foreach ($task in $tasks) {
        $index++
        if ($null -eq $task) {
            Add-Fail ("task #" + $index + " is null.")
            continue
        }

        # stable label for messages: prefer the task id when present
        $taskId = "#$index"
        if ((Test-HasProp -Object $task -Name 'id') -and (Test-NonEmpty $task.id)) {
            $taskId = [string]$task.id
        }

        foreach ($req in @('id', 'title', 'status', 'verified')) {
            if (-not (Test-HasProp -Object $task -Name $req)) {
                Add-Fail ("task " + $taskId + " missing required field: " + $req)
            }
        }

        $status = $null
        if (Test-HasProp -Object $task -Name 'status') {
            $status = [string]$task.status
            if (@($validStatuses) -notcontains $status) {
                Add-Fail ("task " + $taskId + " has invalid status: '" + $status + "' (expected todo/doing/blocked/done)")
            }
        }

        # INVARIANT: done => verified=true AND non-empty evidence
        if ($status -eq 'done') {
            $verifiedOk = $false
            if (Test-HasProp -Object $task -Name 'verified') {
                $verifiedOk = ($task.verified -eq $true)
            }

            $evidenceOk = $false
            if (Test-HasProp -Object $task -Name 'evidence') {
                $evidenceOk = (Test-NonEmpty $task.evidence)
            }

            if (-not $verifiedOk) {
                Add-Fail ("task " + $taskId + " is 'done' but verified is not true.")
            }
            if (-not $evidenceOk) {
                Add-Fail ("task " + $taskId + " is 'done' but evidence is missing or empty.")
            }
            if ($verifiedOk -and $evidenceOk) {
                Add-Ok ("task " + $taskId + " is 'done' with verification and evidence.")
            }
        }
    }
}

# --- check 5: handoff.md exists (warn if missing) --------------------------
if (Test-Path -LiteralPath $handoffPath -PathType Leaf) {
    Add-Ok "handoff.md is present."
} else {
    Add-Warn ("handoff.md not found at " + $handoffPath)
}

# --- check 6: spec.md acceptance-criteria section (only if spec exists) -----
if (Test-Path -LiteralPath $specPath -PathType Leaf) {
    $specText = $null
    try {
        $specText = Get-Content -LiteralPath $specPath -Raw -Encoding UTF8 -ErrorAction Stop
    } catch {
        Add-Warn ("spec.md could not be read: " + $_.Exception.Message)
    }
    if ($null -ne $specText) {
        if ($specText -match '(?im)^\s*#{1,6}?\s*Acceptance\s+criteria') {
            Add-Ok "spec.md has an 'Acceptance criteria' section."
        } else {
            Add-Warn "spec.md is missing an 'Acceptance criteria' section."
        }
    }
}

# --- report ----------------------------------------------------------------
Write-Output "--- Issues ---"
foreach ($f in $script:Fails) { Write-Output ("FAIL: " + $f) }
foreach ($w in $script:Warns) { Write-Output ("WARN: " + $w) }
if (($script:Fails.Count -eq 0) -and ($script:Warns.Count -eq 0)) {
    Write-Output "(no issues)"
}

Write-Output ""
Write-Output "--- Summary ---"
Write-Output ("OK:    " + $script:Oks.Count)
Write-Output ("WARN:  " + $script:Warns.Count)
Write-Output ("FAIL:  " + $script:Fails.Count)
Write-Output ""

# reset any stray native exit state, then return an explicit code
$global:LASTEXITCODE = 0
if ($script:Fails.Count -gt 0) {
    Write-Output "RESULT: FAIL"
    exit 1
}
Write-Output "RESULT: PASS"
exit 0
