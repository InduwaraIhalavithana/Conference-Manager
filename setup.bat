@echo off
title Conference Manager — First-Time Setup
cls
echo.
echo  ============================================================
echo    Conference Manager - First-Time Setup
echo  ============================================================
echo.
echo  [1/2] Creating PostgreSQL database...
echo.
python "%~dp0create_db.py"
if errorlevel 1 (
    echo.
    echo  [ERROR] Database setup failed. Check the error above.
    pause
    exit /b 1
)
echo.
echo  [2/2] Launching services...
echo.
timeout /t 2 /nobreak >nul
call "%~dp0start-services.bat"
