@echo off
title ConferenceHub Launcher
cls

set "ROOT=%~dp0"
set "COMPOSE=%ROOT%docker-compose.dev.yml"

echo.
echo  ============================================================
echo    ConferenceHub v3 ^| Starting All Services
echo  ============================================================
echo.

REM -- Tools on this computer? (uv runs the Python API, npm the website, Docker the databases)
call :find_tool uv "%APPDATA%\Python\Python314\Scripts\uv.exe" || goto :fail
call :find_tool docker "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" || goto :fail
where npm >nul 2>&1 || (
    echo  [!] npm not found. Install Node.js 22 or newer.
    goto :fail
)

REM -- Everything installed? (setup.bat does that once)
if not exist "%ROOT%api\.env" (
    echo  [!] api\.env is missing. Run setup.bat first, then fill it in.
    goto :fail
)
if not exist "%ROOT%web\node_modules" (
    echo  [!] web\node_modules is missing. Run setup.bat first.
    goto :fail
)

REM -- Ports free?
for %%P in (8003 3100) do (
    netstat -ano 2>nul | findstr /L ":%%P " | findstr /L "LISTENING" >nul
    if not errorlevel 1 (
        echo  [!] Port %%P is already in use.
        echo      Run stop-services.bat first, then try again.
        goto :fail
    )
)

REM -- Docker Desktop running? Start it if not, and give it two minutes.
docker info >nul 2>&1
if errorlevel 1 (
    echo  Docker Desktop is not running. Starting it...
    if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
    ) else (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    )
    call :wait_docker || goto :fail
)

echo  [1/4] Starting MongoDB + Redis ^| Docker
docker compose -f "%COMPOSE%" up -d --wait >nul 2>&1
if errorlevel 1 (
    echo        [!] The databases did not start. Run this to see why:
    echo            docker compose -f docker-compose.dev.yml up
    goto :fail
)
echo        MongoDB and Redis are ready.

echo  [2/4] Starting API            ^| port 8003
start "ConferenceHub | API :8003" cmd /c ""%ROOT%scripts\_run_api.bat""
call :wait_for http://127.0.0.1:8003/health "API"

echo  [3/4] Starting worker         ^| emails + timed jobs
start "ConferenceHub | Worker" cmd /c ""%ROOT%scripts\_run_worker.bat""
echo        Worker window opened.

echo  [4/4] Starting website        ^| port 3100
start "ConferenceHub | Web :3100" cmd /c ""%ROOT%scripts\_run_web.bat""
call :wait_for http://127.0.0.1:3100/en "Website"

echo.
echo  ============================================================
echo    All services launched in separate windows.
echo.
echo    Website      :  http://localhost:3100
echo    GraphQL API  :  http://localhost:8003/graphql
echo    API health   :  http://localhost:8003/health
echo.
echo    Run stop-services.bat to shut everything down.
echo  ============================================================
echo.
if /i not "%~1"=="/q" pause
exit /b 0

:fail
echo.
if /i not "%~1"=="/q" pause
exit /b 1

REM -- Make a tool usable: already on PATH, or add the folder of its usual install place.
:find_tool
where %1 >nul 2>&1 && exit /b 0
if exist "%~2" (
    for %%D in ("%~2") do set "PATH=%%~dpD;%PATH%"
    exit /b 0
)
echo  [!] %1 not found. Install it first (see README.md, "Run it locally").
exit /b 1

REM -- Wait up to two minutes for Docker Desktop to answer.
:wait_docker
set /a "_TRIES=0"
:docker_loop
docker info >nul 2>&1 && (
    echo        Docker Desktop is ready.
    exit /b 0
)
set /a "_TRIES+=1"
if %_TRIES% geq 60 (
    echo        [!] Docker Desktop did not start within two minutes. Open it, then try again.
    exit /b 1
)
ping -n 3 127.0.0.1 >nul
goto :docker_loop

REM -- Poll a URL for up to two minutes and say whether it answered (the first website
REM    load compiles the page, so it can take a while).
:wait_for
set /a "_TRIES=0"
:wait_loop
curl.exe -s -o nul --max-time 5 %1 && (
    echo        %~2 is ready.
    exit /b 0
)
set /a "_TRIES+=1"
if %_TRIES% geq 60 (
    echo        [!] %~2 did not answer within two minutes. Check its window for errors.
    exit /b 1
)
ping -n 3 127.0.0.1 >nul
goto :wait_loop
