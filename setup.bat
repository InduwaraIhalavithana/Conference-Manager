@echo off
title Conference Manager - First-Time Setup
cls
echo.
echo  ============================================================
echo    Conference Manager - First-Time Setup
echo  ============================================================
echo.
echo  [1/4] Creating the backend virtual environment...
if not exist "%~dp0backend\.venv\Scripts\python.exe" (
    python -m venv "%~dp0backend\.venv"
    if errorlevel 1 goto :fail
)
echo  [2/4] Installing backend packages (exact versions)...
"%~dp0backend\.venv\Scripts\python.exe" -m pip install -q -r "%~dp0backend\requirements.txt" -r "%~dp0backend\requirements-dev.txt"
if errorlevel 1 goto :fail
echo  [3/4] Creating the PostgreSQL database...
"%~dp0backend\.venv\Scripts\python.exe" "%~dp0create_db.py"
if errorlevel 1 goto :fail
echo  [4/4] Installing frontend packages...
pushd "%~dp0frontend"
call npm ci
popd
if errorlevel 1 goto :fail
echo.
echo  Setup finished. Launching services...
timeout /t 2 /nobreak >nul
call "%~dp0start-services.bat"
exit /b 0

:fail
echo.
echo  [ERROR] Setup failed. Check the error above.
pause
exit /b 1
