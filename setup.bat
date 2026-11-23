@echo off
title ConferenceHub ^| Setup
cls

set "ROOT=%~dp0"

echo.
echo  ============================================================
echo    ConferenceHub v3 ^| One-time Setup
echo  ============================================================
echo.

call :find_uv || goto :fail
where npm >nul 2>&1 || (
    echo  [!] npm not found. Install Node.js 22 or newer.
    goto :fail
)

echo  [1/3] API packages ^(uv sync^)...
pushd "%ROOT%api"
REM -- A .venv whose Python cannot start here (for example one made from inside another app) is rebuilt.
if not exist ".venv" goto :sync
".venv\Scripts\python.exe" -c "pass" >nul 2>&1
if not errorlevel 1 goto :sync
echo        Rebuilding the API's Python environment...
rmdir /s /q ".venv"
:sync
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

REM -- uv runs the Python API. Look on PATH, then where uv's installers put it. (A copy installed
REM    from inside a packaged app such as the Claude desktop app does not count: Windows keeps the
REM    files such an app writes to AppData private to it, so a double-click cannot see them.)
:find_uv
where uv >nul 2>&1 && exit /b 0
call :try_uv "%USERPROFILE%\.local\bin\uv.exe" && exit /b 0
call :try_uv "%LOCALAPPDATA%\Microsoft\WinGet\Links\uv.exe" && exit /b 0
call :try_uv "%USERPROFILE%\.cargo\bin\uv.exe" && exit /b 0
call :try_uv "%APPDATA%\Python\Python314\Scripts\uv.exe" && exit /b 0
echo  [!] uv was not found. Install it once from PowerShell:
echo        powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
echo      then close this window, run setup.bat, and try again.
exit /b 1

:try_uv
if not exist "%~1" exit /b 1
set "PATH=%~dp1;%PATH%"
exit /b 0
