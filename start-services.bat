@echo off
title Conference Manager Launcher
cls

set "ROOT=%~dp0"

echo.
echo  ============================================================
echo    Conference Manager ^| Starting All Services
echo  ============================================================
echo.

REM -- Everything installed? (setup.bat does that once)
if not exist "%ROOT%backend\.venv\Scripts\python.exe" (
    echo  [!] backend\.venv is missing. Run setup.bat first.
    goto :fail
)
if not exist "%ROOT%frontend\node_modules" (
    echo  [!] frontend\node_modules is missing. Run setup.bat first.
    goto :fail
)
if not exist "%ROOT%backend\.env" (
    echo  [!] backend\.env is missing. Copy backend\.env.example to backend\.env and fill it in.
    goto :fail
)

REM -- Ports free?
for %%P in (8002 5174) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P is already in use.
        echo      Run stop-services.bat first, then try again.
        goto :fail
    )
)

echo  [1/2] Starting Backend API   ^| port 8002
start "Conference Manager | Backend :8002" cmd /c ""%ROOT%_run_backend.bat""
call :wait_for http://127.0.0.1:8002/docs "Backend"

echo  [2/2] Starting Frontend      ^| port 5174
start "Conference Manager | Frontend :5174" cmd /c ""%ROOT%_run_frontend.bat""
call :wait_for http://127.0.0.1:5174/ "Frontend"

echo.
echo  ============================================================
echo    All services launched in separate windows.
echo.
echo    Frontend     :  http://localhost:5174
echo    Backend API  :  http://localhost:8002
echo    API Docs     :  http://localhost:8002/docs
echo.
echo    Run stop-services.bat to shut everything down.
echo  ============================================================
echo.
if /i not "%~1"=="/q" pause
exit /b 0

:fail
echo.
if /i not "%~1"=="/q" pause
exit /b 1

REM -- Poll a URL for up to 60 seconds and say whether it answered.
:wait_for
set /a "_TRIES=0"
:wait_loop
curl.exe -s -o nul --max-time 2 %1 && (
    echo        %~2 is ready.
    exit /b 0
)
set /a "_TRIES+=1"
if %_TRIES% geq 60 (
    echo        [!] %~2 did not answer within a minute. Check its window for errors.
    exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto :wait_loop
