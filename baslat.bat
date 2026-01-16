@echo off
chcp 65001 > nul
title ATU Ders Yonetim Sistemi

echo.
echo ========================================
echo   ATU Ders Yonetim Sistemi
echo   Adana Alparslan Turkes Bilim ve Teknoloji Universitesi
echo ========================================
echo.
echo Bagliliklar yukleniyor...
echo.

cd /d "%~dp0"
call npm install

echo.
echo Sunucu baslatiliyor...
echo.

cd /d "%~dp0server"

start "" npm run dev

echo.
echo Sunucu baslatiliyor...
echo Tarayici aciliyor...
echo.

timeout /t 3 /nobreak > nul

start http://localhost:3000/login.html

echo.
echo ========================================
echo Sistem kullanima hazir!
echo Tarayici otomatik acildi.
echo.
echo Durdurmak icin bu pencereyi kapatın.
echo ========================================
echo.
pause
