@echo off
setlocal

set SCRIPT_DIR=%~dp0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run_windows.ps1" %*

if errorlevel 1 (
  echo.
  echo Failed to complete setup/run.
  exit /b %errorlevel%
)

endlocal
