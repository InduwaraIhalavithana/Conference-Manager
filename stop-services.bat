@echo off
title ConferenceHub ^| Stop Services
cls

set "ROOT=%~dp0"
set "COMPOSE=%ROOT%docker-compose.dev.yml"

echo.
echo  ============================================================
echo    ConferenceHub v3 ^| Stopping All Services
echo  ============================================================
echo.

REM -- Step 1: Close the service windows, found by the script they run (not by title:
REM    in Windows Terminal the window titles are not visible to taskkill). /T also ends
REM    the server inside each window. Only this project's windows match.
echo  Closing the API, worker and website windows...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { $_.CommandLine -and ($_.CommandLine.Contains('%ROOT%scripts\_run_api.bat') -or $_.CommandLine.Contains('%ROOT%scripts\_run_worker.bat') -or $_.CommandLine.Contains('%ROOT%scripts\_run_web.bat')) } | ForEach-Object { taskkill /F /T /PID $_.ProcessId | Out-Null }"

call :sleep 1

REM -- Step 2: Anything still listening on our ports (by PID, so other projects are safe)
echo  Cleaning up leftover processes on ports 8003, 3100...
for %%P in (8003 3100) do (
    for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr /L ":%%P " ^| findstr /L "LISTENING"') do (
        if not "%%i"=="" taskkill /F /T /PID %%i >nul 2>&1
    )
)

REM -- Step 3: Stop the database containers (their data is kept for next time).
REM    "stop-services.bat /keepdb" leaves MongoDB and Redis running.
if /i "%~1"=="/keepdb" goto :verify
if /i "%~2"=="/keepdb" goto :verify
where docker >nul 2>&1 || set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;%PATH%"
docker info >nul 2>&1
if errorlevel 1 (
    echo  Docker Desktop is not running, so the databases are already stopped.
) else (
    echo  Stopping MongoDB and Redis ^(data is kept^)...
    docker compose -f "%COMPOSE%" stop >nul 2>&1
)

:verify
call :sleep 1

REM -- Step 4: Verify
echo.
set "REMAINING=0"
for %%P in (8003 3100) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P still in use.
        set "REMAINING=1"
    )
)

if "%REMAINING%"=="0" (
    echo  All ConferenceHub services stopped cleanly.
) else (
    echo.
    echo  Some ports are still occupied. Try running as Administrator.
)

echo.
if /i not "%~1"=="/q" if /i not "%~2"=="/q" pause
exit /b %REMAINING%

REM -- Wait N seconds (ping works even when there is no keyboard, unlike timeout)
:sleep
set /a "_PINGS=%~1+1"
ping -n %_PINGS% 127.0.0.1 >nul
exit /b 0
