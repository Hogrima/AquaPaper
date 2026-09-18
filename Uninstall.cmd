@echo off
setlocal
title AquaPaper Uninstall
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\Install.ps1" -Uninstall
if errorlevel 1 (
  echo.
  echo Uninstall did not complete. See the message above.
  pause
  exit /b 1
)
echo.
pause
