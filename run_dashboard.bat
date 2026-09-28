@echo off
title SIP-RLTH Dashboard Launcher
echo ========================================================
echo   SIP-RLTH - Dashboard Monitoring Usulan RTLH
echo ========================================================
echo Memeriksa status web server...
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://localhost:8080/' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo Menjalankan web server lokal...
    start /b powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0server.ps1"
    timeout /t 2 >nul
)
echo Membuka dashboard di peramban web...
start "" "http://localhost:8080/"
timeout /t 2 >nul
exit
