@echo off
setlocal EnableExtensions

title LabSpace AI Launcher
cd /d "%~dp0"

set "LABSPACE_URL=http://127.0.0.1:3004/"
set "PORT=3004"

call :is_running
if not errorlevel 1 goto open_labspace

where node.exe >nul 2>&1
if errorlevel 1 goto node_missing

where npm.cmd >nul 2>&1
if errorlevel 1 goto node_missing

if not exist "node_modules\.bin\tsx.cmd" (
  echo.
  echo Preparing LabSpace for its first launch...
  call npm.cmd install
  if errorlevel 1 goto install_failed
)

echo.
echo Starting LabSpace AI on %LABSPACE_URL%
start "LabSpace AI Server" /min cmd.exe /d /k "cd /d ""%~dp0"" && set ""PORT=3004"" && npm.cmd run dev"

set /a "WAIT_COUNT=0"

:wait_for_server
call :is_running
if not errorlevel 1 goto open_labspace

set /a "WAIT_COUNT+=1"
if %WAIT_COUNT% GEQ 60 goto server_timeout
timeout /t 1 /nobreak >nul
goto wait_for_server

:open_labspace
if /i "%~1"=="--no-browser" goto success
start "" "%LABSPACE_URL%"

:success
echo LabSpace AI is ready at %LABSPACE_URL%
exit /b 0

:is_running
powershell.exe -NoLogo -NoProfile -NonInteractive -Command ^
  "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%LABSPACE_URL%' -TimeoutSec 1; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } } catch {}; exit 1" >nul 2>&1
exit /b %errorlevel%

:node_missing
echo.
echo LabSpace could not start because Node.js and npm were not found.
echo Install Node.js 22 or newer, then double-click this launcher again.
echo https://nodejs.org/
goto failed

:install_failed
echo.
echo LabSpace dependencies could not be installed.
echo Check the internet connection and the npm error shown above, then try again.
goto failed

:server_timeout
echo.
echo LabSpace did not become ready within 60 seconds.
echo Review the minimized "LabSpace AI Server" window for the startup error.

:failed
echo.
pause
exit /b 1
