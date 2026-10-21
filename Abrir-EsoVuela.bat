@echo off
setlocal
cd /d "%~dp0"

echo Preparando Eso Vuela...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo No se pudo compilar la aplicacion. Revisa los mensajes anteriores.
  pause
  exit /b 1
)

start "Eso Vuela - Servidor Node" cmd /k "npm.cmd start"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
