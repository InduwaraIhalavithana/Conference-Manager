@echo off
title Conference Manager Launcher
cls

set "ROOT=%~dp0"

echo.
echo  ============================================================
echo    Conference Manager ^| Starting All Services
echo  ============================================================
echo.

REM ── Check if ports are already occupied ─────────────────────────────────────
for %%P in (8002 5174) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P is already in use.
        echo      Run stop-services.bat first, then try again.
        echo.
        pause
        exit /b 1
    )
)

echo  [1/2] Starting Backend API   ^| port 8002
start "Conference Manager | Backend :8002" "%ROOT%_run_backend.bat"

echo.
echo  Waiting 4 seconds for backend to initialise...
timeout /t 4 /nobreak >nul

echo  [2/2] Starting Frontend      ^| port 5174
start "Conference Manager | Frontend :5174" "%ROOT%_run_frontend.bat"

echo.
echo  ============================================================
echo    All services launched in separate windows.
echo.
echo    Backend API  :  http://localhost:8002
echo    Frontend     :  http://localhost:5174
echo    API Docs     :  http://localhost:8002/docs
echo    Log          :  %ROOT%cm_backend.log
echo.
echo    Run stop-services.bat to shut everything down.
echo  ============================================================
echo.
pause
