<#
  tunnel-up.ps1 - one-command bring-up / post-reboot recovery for the Brown Zone public tunnel.

  Usage:   powershell -ExecutionPolicy Bypass -File scripts\tunnel-up.ps1
           npm run tunnel:up
           npm run tunnel:up -- -Port 8911     (if 8910 is reserved by Hyper-V this boot)

  Steps:   start Docker (+clear chronic orphan socket) -> start DB container (NO re-seed)
           -> start cloudflared quick tunnel -> write the new public URL into .env.local APP_URL
           -> start the production server (reuses existing .next build) -> print URL + self-check.
  Stop:    npm run tunnel:down
  Notes:   cloudflared + the server run hidden and must stay alive; do NOT sleep the PC.
           The trycloudflare URL changes on every run; this script writes it back to APP_URL.
           ASCII-only on purpose (PowerShell 5.1 mis-reads non-BOM UTF-8 .ps1 on zh-CN Windows).
#>
param([int]$Port = 8910)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repo    = Split-Path -Parent $PSScriptRoot
$cf      = Join-Path $repo ".cloudflared\cloudflared.exe"
$cfLog   = Join-Path $repo ".cloudflared\tunnel.log"
$srvLog  = Join-Path $repo ".cloudflared\server.log"
$envFile = Join-Path $repo ".env.local"
Set-Location $repo

function Test-Docker { cmd /c "docker info >NUL 2>NUL"; return ($LASTEXITCODE -eq 0) }
function Fail($m) { Write-Host ("ERROR: " + $m) -ForegroundColor Red; exit 1 }

if (-not (Test-Path $cf))      { Fail ".cloudflared\cloudflared.exe missing - download cloudflared to that path first" }
if (-not (Test-Path $envFile)) { Fail ".env.local missing" }

# 1) Docker (skip if already running; else clear orphan sockets, launch, wait)
Write-Host "1/6 Docker..." -ForegroundColor Cyan
if (Test-Docker) {
  Write-Host "    already running, skip"
} else {
  $run = "$env:LOCALAPPDATA\Docker\run"
  if (Test-Path "$run\dockerInference") {
    try { Rename-Item $run ("run.broken-" + (Get-Random)) -ErrorAction Stop; Write-Host "    cleared orphan socket run\dockerInference" }
    catch { Write-Host "    (could not rename orphan socket, continuing)" }
  }
  $se = "$env:LOCALAPPDATA\docker-secrets-engine"
  if (Test-Path "$se\engine.sock") { try { Rename-Item $se ("docker-secrets-engine.broken-" + (Get-Random)) -ErrorAction Stop } catch {} }
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  Write-Host "    launched Docker Desktop, waiting for daemon (up to ~150s)..."
  $ok = $false
  for ($i = 0; $i -lt 50; $i++) { if (Test-Docker) { $ok = $true; break }; Start-Sleep 3 }
  if (-not $ok) { Fail "Docker daemon did not come up. If an error dialog shows, click Quit then re-run; if it persists: Docker Desktop -> Troubleshoot -> Reset to factory defaults" }
  Write-Host "    Docker OK"
}

# 2) DB container. Volume persists => data + admin intact. NEVER run db:up here (it dev-seeds the demo backdoor back).
Write-Host "2/6 DB container (no re-seed)..." -ForegroundColor Cyan
cmd /c "docker compose -f docker-compose.local.yml up -d >NUL 2>NUL"
$health = ""
for ($i = 0; $i -lt 30; $i++) {
  $health = (cmd /c "docker inspect -f {{.State.Health.Status}} brownzone-pg 2>NUL")
  if ($health) { $health = ([string]$health).Trim() }
  if ($health -eq "healthy") { break }
  Start-Sleep 2
}
if ($health -ne "healthy") { Fail ("brownzone-pg not healthy (got '" + $health + "')") }
Write-Host "    DB healthy"

# 3) port not reserved by Hyper-V (the reserved ranges regenerate every boot)
Write-Host ("3/6 check port " + $Port + "...") -ForegroundColor Cyan
$excluded = $false
netsh int ipv4 show excludedportrange protocol=tcp | Select-String -Pattern '^\s+\d+\s+\d+' | ForEach-Object {
  $p = ($_.ToString() -replace '\*', '').Trim() -split '\s+'
  if ($Port -ge [int]$p[0] -and $Port -le [int]$p[1]) { $excluded = $true }
}
if ($excluded) { Fail ("port " + $Port + " is reserved by Hyper-V this boot. Use another: npm run tunnel:up -- -Port 8911") }
Write-Host ("    " + $Port + " is free")

# 4) cloudflared tunnel -> grab the new public URL from its log
Write-Host "4/6 cloudflared tunnel..." -ForegroundColor Cyan
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
foreach ($f in @($cfLog, "$cfLog.err")) { if (Test-Path $f) { Remove-Item $f -Force } }
Start-Process -FilePath $cf -ArgumentList "tunnel", "--url", ("http://localhost:" + $Port) `
  -RedirectStandardOutput $cfLog -RedirectStandardError "$cfLog.err" -WindowStyle Hidden
$url = $null
for ($i = 0; $i -lt 30; $i++) {
  foreach ($f in @($cfLog, "$cfLog.err")) {
    if (Test-Path $f) {
      $m = Select-String -Path $f -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value; break }
    }
  }
  if ($url) { break }
  Start-Sleep 1
}
if (-not $url) { Fail ("no tunnel URL (see " + $cfLog + ")") }
Write-Host ("    public URL: " + $url)

# 5) write APP_URL (required, else checkOrigin rejects all writes/registrations)
Write-Host "5/6 write APP_URL..." -ForegroundColor Cyan
$content = [System.IO.File]::ReadAllText($envFile)
if ($content -match '(?m)^APP_URL=') {
  $content = [regex]::Replace($content, '(?m)^APP_URL=.*$', ("APP_URL=" + $url))
} else {
  $content = ("APP_URL=" + $url + "`r`n") + $content
}
[System.IO.File]::WriteAllText($envFile, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("    APP_URL=" + $url)

# 6) production server (reuses existing .next build; kill whatever holds the port)
Write-Host ("6/6 production server :" + $Port + "...") -ForegroundColor Cyan
$old = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($old) { $old.OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }
# also kill the parent cmd.exe that holds the redirected log file open (the port-listener kill above only gets node)
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match [regex]::Escape("npm run start -- -H 127.0.0.1 -p " + $Port) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
foreach ($f in @($srvLog, "$srvLog.err")) { if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue } }
Start-Process -FilePath "cmd.exe" -ArgumentList ("/c npm run start -- -H 127.0.0.1 -p " + $Port) `
  -WorkingDirectory $repo -RedirectStandardOutput $srvLog -RedirectStandardError "$srvLog.err" -WindowStyle Hidden
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  cmd /c ("curl.exe -s -o NUL --max-time 3 http://localhost:" + $Port + " >NUL 2>NUL")
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep 2
}
if (-not $ready) { Write-Host ("    WARN: server not ready in 80s, see " + $srvLog) -ForegroundColor Yellow } else { Write-Host "    server OK" }

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host " PUBLIC URL (share with external users):" -ForegroundColor Green
Write-Host ("   " + $url) -ForegroundColor Green
Write-Host ("   local:  http://localhost:" + $Port)
Write-Host "   admin:  z5239663@gmail.com"
Write-Host "   stop:   npm run tunnel:down"
Write-Host "   note:   keep Docker running + PC awake; the URL changes on next run."
Write-Host "===================================================================" -ForegroundColor Green
