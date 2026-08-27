@echo off
setlocal EnableExtensions
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
set "PORT=8765"
set "URL=http://127.0.0.1:%PORT%/"
set "HEALTH=http://127.0.0.1:%PORT%/healthz"
set "STATE=%ProgramData%\KuInfoekraan"
set "LOG=%STATE%\logs\kiosk-start.log"
set "EDGE_PROFILE=%LOCALAPPDATA%\KuInfoekraan\edge-profile"
if not exist "%STATE%\logs" mkdir "%STATE%\logs" >nul 2>&1
if not exist "%EDGE_PROFILE%" mkdir "%EDGE_PROFILE%" >nul 2>&1

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$log='%LOG%'; if(Test-Path -LiteralPath $log){$item=Get-Item -LiteralPath $log; if($item.Length -ge 1MB){Move-Item -LiteralPath $log -Destination ($log + '.1') -Force}}" >nul 2>&1
echo [%date% %time%] Kiosk start >> "%LOG%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "try{$r=Invoke-WebRequest -UseBasicParsing -Uri '%HEALTH%' -TimeoutSec 1; if($r.Content.Trim() -eq 'KU-INFOEKRAAN-OK'){exit 0}}catch{}; exit 1" >nul 2>&1
if errorlevel 1 (
  start "KU Local Server" /min powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0local-server.ps1" -Port %PORT% -Root "%ROOT%\dist" -ConfigPath "%ROOT%\config.js" -StateRoot "%STATE%"
)

set /a TRY=0
:WAIT_SERVER
set /a TRY+=1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "try{$r=Invoke-WebRequest -UseBasicParsing -Uri '%HEALTH%' -TimeoutSec 1; if($r.StatusCode -eq 200 -and $r.Content.Trim() -eq 'KU-INFOEKRAAN-OK'){exit 0}}catch{}; exit 1" >nul 2>&1
if not errorlevel 1 goto SERVER_READY
if %TRY% GEQ 30 goto SERVER_FAILED
timeout /t 1 /nobreak >nul
goto WAIT_SERVER

:SERVER_FAILED
echo [%date% %time%] Server ei vastanud 30 sekundi jooksul >> "%LOG%"
exit /b 2

:SERVER_READY
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=msedge.exe"
start "KU Infoekraan" "%EDGE%" ^
  --user-data-dir="%EDGE_PROFILE%" ^
  --kiosk "%URL%" ^
  --edge-kiosk-type=fullscreen ^
  --kiosk-idle-timeout-minutes=0 ^
  --force-device-scale-factor=1 ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --no-first-run ^
  --noerrdialogs ^
  --disable-session-crashed-bubble ^
  --disable-features=CalculateNativeWinOcclusion
exit /b 0
