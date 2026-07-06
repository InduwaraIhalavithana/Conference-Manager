@echo off
title Conference Manager ^| Stop Services
cls

echo.
echo  ============================================================
echo    Conference Manager ^| Stopping All Services
echo  ============================================================
echo.

REM ── Step 1: Kill the cmd windows by title ───────────────────────────────────
echo  Closing service windows...
taskkill /F /T /FI "WINDOWTITLE eq Conference Manager | Backend :8002"  >nul 2>&1
taskkill /F /T /FI "WINDOWTITLE eq Conference Manager | Frontend :5174" >nul 2>&1

timeout /t 1 /nobreak >nul

REM ── Step 2: Port cleanup (by PID only — safe when other projects are running) ─
echo  Cleaning up leftover processes on ports 8002, 5174...
for %%P in (8002 5174) do (
    for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr /L ":%%P " ^| findstr /L "LISTENING"') do (
        if not "%%i"=="" (
            taskkill /F /T /PID %%i >nul 2>&1
        )
    )
)

timeout /t 1 /nobreak >nul

REM ── Step 3: Verify ───────────────────────────────────────────────────────────
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
pause
