@echo off
setlocal
set "launcher=%~dp0.runtime\Bootcamp Studying Tool.exe"

if not exist "%launcher%" (
    echo The Windows launcher is missing.
    echo Run windows\setup.ps1 in PowerShell from the project folder, then try again.
    pause
    exit /b 1
)

start "" /wait "%launcher%"
exit /b %errorlevel%
