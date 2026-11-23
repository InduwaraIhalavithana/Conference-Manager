@echo off
title ConferenceHub ^| Web :3100
cd /d "%~dp0..\web"
call npm run dev
pause
