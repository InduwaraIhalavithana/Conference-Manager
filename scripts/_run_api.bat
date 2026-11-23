@echo off
title ConferenceHub ^| API :8003
cd /d "%~dp0..\api"
where uv >nul 2>&1 || set "PATH=%USERPROFILE%\.local\bin;%LOCALAPPDATA%\Microsoft\WinGet\Links;%USERPROFILE%\.cargo\bin;%APPDATA%\Python\Python314\Scripts;%PATH%"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8003
pause
