<#
  tunnel-down.ps1 - stop the public tunnel + production server (DB / Docker kept running).
  Usage: npm run tunnel:down   or   scripts\tunnel-down.ps1 -Port 8910
  To also stop the DB: docker compose -f docker-compose.local.yml down
#>
param([int]$Port = 8910)
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$old = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($old) { $old.OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }
Write-Host ("stopped cloudflared tunnel + :" + $Port + " production server (DB / Docker still running).")
