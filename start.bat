@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 1; Start-Process 'http://127.0.0.1:8080'"
python -m http.server 8080 --bind 127.0.0.1
