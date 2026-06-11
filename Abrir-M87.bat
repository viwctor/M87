@echo off
REM ============================================================
REM  M87 - abre o app localmente com 1 clique
REM  Sobe o servidor (se ainda nao estiver no ar) e abre o navegador.
REM  Obs.: depois de hospedar no GitHub Pages voce nao precisa mais disto.
REM ============================================================
cd /d "%~dp0"
start "M87-server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_serve.ps1"
REM espera 1s o servidor subir e abre o navegador padrao
ping -n 2 127.0.0.1 >nul
start "" "http://localhost:8099"
exit
