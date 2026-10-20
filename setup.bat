@echo off
title Conference Manager - First-Time Setup
cls

set "ROOT=%~dp0"

echo.
echo  ============================================================
echo    Conference Manager - First-Time Setup
echo  ============================================================
echo.

REM -- Tools and settings first, so nothing is half-installed.
where python >nul 2>&1 || (echo  [!] Python was not found. Install Python 3.12 or newer and try again. & goto :fail)
where npm >nul 2>&1 || (echo  [!] Node.js was not found. Install Node.js 22 or newer and try again. & goto :fail)
if not exist "%ROOT%backend\.env" (
    copy "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul
    echo  [!] Created backend\.env from backend\.env.example.
    echo      Fill in DATABASE_URL, SECRET_KEY and ADMIN_INITIAL_PASSWORD, then run setup.bat again.
    goto :fail
)
REM npm ci replaces node_modules, which a running frontend keeps locked.
for %%P in (8002 5174) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P is in use. Run stop-services.bat first, then try again.
        goto :fail
    )
)

echo  [1/4] Creating the backend virtual environment...
if not exist "%ROOT%backend\.venv\Scripts\python.exe" (
    python -m venv "%ROOT%backend\.venv"
    if errorlevel 1 goto :fail
)

echo  [2/4] Installing backend packages (exact versions)...
"%ROOT%backend\.venv\Scripts\python.exe" -m pip install -q -r "%ROOT%backend\requirements.txt" -r "%ROOT%backend\requirements-dev.txt"
if errorlevel 1 goto :fail

echo  [3/4] Creating the PostgreSQL database...
"%ROOT%backend\.venv\Scripts\python.exe" "%ROOT%create_db.py"
if errorlevel 1 goto :fail

echo  [4/4] Installing frontend packages...
pushd "%ROOT%frontend"
call npm ci
set "NPM_RESULT=%ERRORLEVEL%"
popd
if not "%NPM_RESULT%"=="0" goto :fail

echo.
echo  Setup finished. Launching services...
call "%ROOT%start-services.bat" %1
exit /b 0

:fail
echo.
echo  [ERROR] Setup did not finish. Check the message above.
if /i not "%~1"=="/q" pause
exit /b 1
