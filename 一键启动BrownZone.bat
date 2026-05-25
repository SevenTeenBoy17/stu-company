@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title Brown Zone Local Launcher

echo.
echo ==================================================
echo   Brown Zone / Mr.Brown AI Sandbox
echo   Local one-click launcher
echo ==================================================
echo.

if not exist "package.json" (
  echo [ERROR] This launcher must be placed in the brown-zone-web root folder.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js 20 LTS or 22 LTS, then run this file again.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Please check whether Node.js is installed correctly.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\next\dist\bin\next" (
  echo [ERROR] node_modules is missing or incomplete.
  echo If this computer is offline, copy the full brown-zone-web folder again.
  echo The node_modules folder must be included.
  echo.
  pause
  exit /b 1
)

set "PORT="
for %%P in (3000 3001 3002 3003 3004) do (
  if not defined PORT (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %%P -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>nul
    if not errorlevel 1 set "PORT=%%P"
  )
)

if not defined PORT (
  echo [ERROR] Ports 3000 to 3004 are all busy.
  echo Please close other local web services and try again.
  echo.
  pause
  exit /b 1
)

set "LOCAL_URL=http://127.0.0.1:%PORT%/demo"

echo [READY] Starting Brown Zone locally.
echo.
echo URL:
echo %LOCAL_URL%
echo.
echo Notes:
echo 1. The browser will open automatically after the page is ready.
echo 2. Keep this black window open while using the app.
echo 3. To stop after class, press Ctrl + C, then type Y and press Enter.
echo.

start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%LOCAL_URL%'; for ($i = 0; $i -lt 90; $i++) { try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $url; exit 0 } catch { Start-Sleep -Seconds 1 } }; Start-Process $url"

call npm.cmd run dev -- --hostname 127.0.0.1 --port %PORT%

echo.
echo Brown Zone local server has stopped.
pause
