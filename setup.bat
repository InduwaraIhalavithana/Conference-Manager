@echo off
title ConferenceHub ^| Setup
cls

set "ROOT=%~dp0"

echo.
echo  ============================================================
echo    ConferenceHub v3 ^| One-time Setup
echo  ============================================================
echo.

where uv >nul 2>&1 || set "PATH=%APPDATA%\Python\Python314\Scripts;%PATH%"
where uv >nul 2>&1 || (
    echo  [!] uv not found. Install it: https://docs.astral.sh/uv/
    goto :fail
)
where npm >nul 2>&1 || (
    echo  [!] npm not found. Install Node.js 22 or newer.
    goto :fail
)

echo  [1/3] API packages ^(uv sync^)...
pushd "%ROOT%api"
uv sync || (popd & goto :fail)
popd

echo  [2/3] Website packages ^(npm ci^)...
pushd "%ROOT%web"
call npm ci || (popd & goto :fail)
popd

echo  [3/3] Settings file...
if exist "%ROOT%api\.env" (
    echo        api\.env already exists, left as it is.
) else (
    copy "%ROOT%api\.env.example" "%ROOT%api\.env" >nul
    echo        Created api\.env from the example. Open it and set SECRET_KEY and
    echo        ADMIN_INITIAL_PASSWORD before the first start.
)

echo.
echo  Setup finished. Run start-services.bat to start everything.
echo.
if /i not "%~1"=="/q" pause
exit /b 0

:fail
echo.
echo  [!] Setup stopped. Read the message above.
if /i not "%~1"=="/q" pause
exit /b 1
