@echo off
title Conference Manager ^| Stop Services
cls

set "ROOT=%~dp0"

echo.
echo  ============================================================
echo    Conference Manager ^| Stopping All Services
echo  ============================================================
echo.

REM -- Step 1: Close the service windows, found by the script they run (not by title:
REM    in Windows Terminal the window titles are not visible to taskkill). /T also ends
REM    the server inside each window. Only this project's windows match.
echo  Closing service windows...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { $_.CommandLine -and ($_.CommandLine.Contains('%ROOT%_run_backend.bat') -or $_.CommandLine.Contains('%ROOT%_run_frontend.bat')) } | ForEach-Object { taskkill /F /T /PID $_.ProcessId | Out-Null }"

call :sleep 1

REM -- Step 2: Anything still listening on our ports (by PID, so other projects are safe)
echo  Cleaning up leftover processes on ports 8002, 5174...
for %%P in (8002 5174) do (
    for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr /L ":%%P " ^| findstr /L "LISTENING"') do (
        if not "%%i"=="" taskkill /F /T /PID %%i >nul 2>&1
    )
)

call :sleep 1

REM -- Step 3: Verify
echo.
set "REMAINING=0"
for %%P in (8002 5174) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P still in use.
        set "REMAINING=1"
    )
)

if "%REMAINING%"=="0" (
    echo  All Conference Manager services stopped cleanly.
) else (
    echo.
    echo  Some ports are still occupied. Try running as Administrator.
)

echo.
if /i not "%~1"=="/q" pause
exit /b %REMAINING%

REM -- Wait N seconds (ping works even when there is no keyboard, unlike timeout)
:sleep
set /a "_PINGS=%~1+1"
ping -n %_PINGS% 127.0.0.1 >nul
exit /b 0
