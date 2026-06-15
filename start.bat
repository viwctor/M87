@echo off
cd /d "%~dp0"
start "M87-server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_serve.ps1"
REM espera 1s o servidor subir e abre o navegador padrao
ping -n 2 127.0.0.1 >nul
start "" "http://localhost:8700"
exit
