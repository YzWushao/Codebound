@echo off
setlocal
set "CODEBOUND_EXE=%~dp0release\win-unpacked\Codebound.exe"
if not exist "%CODEBOUND_EXE%" (
  echo Codebound portable build is missing.
  echo Build the desktop app first, or extract the Windows ZIP release.
  pause
  exit /b 1
)
start "" "%CODEBOUND_EXE%"
