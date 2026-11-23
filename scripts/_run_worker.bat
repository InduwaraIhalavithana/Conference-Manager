@echo off
title ConferenceHub ^| Worker
cd /d "%~dp0..\api"
where uv >nul 2>&1 || set "PATH=%APPDATA%\Python\Python314\Scripts;%PATH%"
uv run arq app.worker.WorkerSettings
pause
