@echo off
title ConferenceHub ^| Worker
cd /d "%~dp0..\api"
where uv >nul 2>&1 || set "PATH=%USERPROFILE%\.local\bin;%LOCALAPPDATA%\Microsoft\WinGet\Links;%USERPROFILE%\.cargo\bin;%APPDATA%\Python\Python314\Scripts;%PATH%"
uv run arq app.worker.WorkerSettings
pause
