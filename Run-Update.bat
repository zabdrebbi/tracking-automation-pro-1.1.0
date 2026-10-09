@echo off
title Tracking Automation Pro - Updater
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update-TrackingAutomation.ps1"
exit /b