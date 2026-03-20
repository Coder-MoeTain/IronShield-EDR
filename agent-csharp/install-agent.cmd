@echo off
REM IronShield EDR Agent Installer
REM Run as Administrator: Right-click -> Run as administrator
REM
REM Usage:
REM   install-agent.cmd
REM   install-agent.cmd https://edr.example.com your-registration-token
REM   install-agent.cmd uninstall

setlocal
cd /d "%~dp0"

if "%~1"=="" (
    echo IronShield EDR Agent Installer
    echo.
    echo Usage:
    echo   install-agent.cmd [ServerUrl] [RegistrationToken]
    echo   install-agent.cmd uninstall
    echo.
    echo Example:
    echo   install-agent.cmd https://edr.example.com abc123token
    echo   install-agent.cmd http://localhost:3001 your-token
    echo.
    set SERVER=http://localhost:3001
    set /p SERVER="Server URL [http://localhost:3001]: "
    if "%SERVER%"=="" set SERVER=http://localhost:3001
    set /p TOKEN="Registration Token: "
    powershell -ExecutionPolicy Bypass -File "%~dp0Install-Agent.ps1" -ServerUrl "%SERVER%" -RegistrationToken "%TOKEN%"
) else if /i "%~1"=="uninstall" (
    powershell -ExecutionPolicy Bypass -File "%~dp0Install-Agent.ps1" -Uninstall
) else (
    powershell -ExecutionPolicy Bypass -File "%~dp0Install-Agent.ps1" -ServerUrl "%~1" -RegistrationToken "%~2"
)

endlocal
