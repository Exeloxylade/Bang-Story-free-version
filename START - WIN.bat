@echo off
setlocal
rem Bang Story - klik 2x file ini untuk membuka aplikasi di Windows.
cd /d "%~dp0"
title Bang Story

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js belum terpasang di komputer ini.
  echo  Unduh versi LTS dari https://nodejs.org, pasang, lalu klik 2x "START - WIN.bat" lagi.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

rem Pertama kali dibuka, atau folder node_modules berasal dari OS lain: pasang ulang.
if not exist "node_modules\.bangstory-windows" (
  if exist "node_modules" (
    echo  Membersihkan node_modules lama...
    rmdir /s /q "node_modules"
  )
  echo.
  echo  Menyiapkan Bang Story untuk pertama kali.
  echo  Butuh koneksi internet dan beberapa menit, jangan tutup jendela ini...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Gagal memasang. Periksa koneksi internet lalu coba lagi.
    pause
    exit /b 1
  )
  echo ok> "node_modules\.bangstory-windows"
)

rem Electron mengunduh programnya sendiri saat pertama dipakai.
rem ZIP updates can add dependencies even when node_modules is already present.
node -e "const fs=require('node:fs'),p=require('./package.json');for(const n of ['hyperframes','@puppeteer/browsers','gsap','ffprobe-static']){const f='node_modules/'+n+'/package.json';if(!fs.existsSync(f)||JSON.parse(fs.readFileSync(f,'utf8')).version!==p.dependencies[n])process.exit(1)}" >nul 2>nul
if errorlevel 1 (
  echo  Memperbarui komponen Motion dan SFX...
  call npm install
  if errorlevel 1 (
    echo  Gagal memperbarui komponen. Periksa koneksi internet lalu coba lagi.
    pause
    exit /b 1
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo  Mengunduh Electron...
  call node "node_modules\electron\install.js"
  if errorlevel 1 (
    echo.
    echo  Gagal mengunduh Electron. Periksa koneksi internet lalu coba lagi.
    pause
    exit /b 1
  )
)

rem Rebuild after ZIP updates so an old out folder cannot hide new fixes.
(
  echo  Menyusun aplikasi...
  call npm run build
  if errorlevel 1 (
    echo.
    echo  Gagal menyusun aplikasi.
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" .
exit /b 0
