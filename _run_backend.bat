@echo off
title Conference Manager ^| Backend :8002
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
    echo  [!] backend\.venv is missing. Run setup.bat first.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8002
pause
