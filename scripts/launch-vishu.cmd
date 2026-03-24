@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0launch-vishu.ps1" -SkipBuild
endlocal
