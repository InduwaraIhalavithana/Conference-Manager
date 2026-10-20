@echo off
title Conference Manager ^| Frontend :5174
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo  [!] frontend\node_modules is missing. Run setup.bat first.
    pause
    exit /b 1
)
call npm run dev
pause
