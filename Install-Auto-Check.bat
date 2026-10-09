@echo off
setlocal
set "LAUNCHER=%~dp0Run-Update-Hidden.vbs"
schtasks /Create /F /SC HOURLY /MO 6 /TN "TrackingAutomationPro-GitHub-Updater" /TR "wscript.exe \"%LAUNCHER%\"" /IT
if errorlevel 1 (
  echo Could not create scheduled task. Use Run-Update.bat manually.
  pause
  exit /b 1
)
echo Automatic check scheduled every 6 hours while you are logged in.
echo It runs fully in the background with no window and no Chrome tab.
echo Log file: this folder\.tracking-automation-pro-update.log
pause