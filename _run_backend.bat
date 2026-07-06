@echo off
title Conference Manager ^| Backend :8002
echo [%date% %time%] Backend starting... > "%~dp0cm_backend.log"
cd /d "%~dp0backend"
echo [%date% %time%] CWD: %CD% >> "%~dp0cm_backend.log"
uvicorn app.main:app --host 127.0.0.1 --port 8002 >> "%~dp0cm_backend.log" 2>&1
echo [%date% %time%] Exited with code: %ERRORLEVEL% >> "%~dp0cm_backend.log"
pause
