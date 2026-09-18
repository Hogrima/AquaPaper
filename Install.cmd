@echo off
setlocal
title AquaPaper Setup
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\Install.ps1" -Launch
if errorlevel 1 (
  echo.
  echo Installation did not complete. See the message above.
  pause
  exit /b 1
)
echo.
pause
