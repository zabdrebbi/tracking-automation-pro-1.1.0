@echo off
setlocal
set "LAUNCHER=%~dp0Run-Update-Hidden.vbs"
schtasks /Create /F /SC MINUTE /MO 30 /TN "TrackingAutomationPro-GitHub-Updater" /TR "wscript.exe \"%LAUNCHER%\"" /IT
if errorlevel 1 (
  echo Could not create scheduled task. Use Run-Update.bat manually.
  pause
  exit /b 1
)
echo Automatic check scheduled every 30 minutes while you are logged in.
echo It runs fully in the background with no window and no Chrome tab.
echo Log file: this folder\.tracking-automation-pro-update.log
pause