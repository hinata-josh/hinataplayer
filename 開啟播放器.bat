@echo off
chcp 65001 >nul
title Drive 音檔播放器
cd /d "%~dp0"

set "AP_PORT=8110"
set "AP_HOST=127.0.0.1"
set "URL=http://localhost:%AP_PORT%/"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] 找不到 node，請先安裝 Node.js 再重試。
  echo.
  pause
  exit /b 1
)

if defined AP_DRYRUN (
  echo DRYRUN URL=%URL% ROOT=%CD% CHROME_EXISTS=%CHROME%
  exit /b 0
)

echo.
echo   啟動本機伺服器 %URL%
echo   （Google 登入只在 localhost / https 有效，所以請走這個網址）
echo.

if exist "%CHROME%" (
  start "" "%CHROME%" "%URL%"
) else (
  start "" "%URL%"
)

node server.js

echo.
echo   伺服器已結束。
pause
