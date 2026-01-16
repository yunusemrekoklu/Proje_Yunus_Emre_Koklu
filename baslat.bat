@echo off
chcp 65001 > nul
title ATÜ Ders Yönetim Sistemi

echo.
echo ========================================
echo   ATÜ Ders Yönetim Sistemi
echo   Adana Alparslan Türkeş Bilim ve Teknoloji Üniversitesi
echo ========================================
echo.
echo Sunucu başlatılıyor...
echo.

cd /d "%~dp0server"

start "" npm run dev

echo.
echo Sunucu başlatılıyor...
echo Tarayıcı açılıyor...
echo.

timeout /t 3 /nobreak > nul

start http://localhost:3000/login.html

echo.
echo ========================================
echo Sistem kullanıma hazır!
echo Tarayıcı otomatik açıldı.
echo.
echo Durdurmak için bu pencereyi kapatın.
echo ========================================
echo.
pause
