@echo off
chcp 65001 >nul
title Drive 音檔播放器 - 手機連線（區網）
cd /d "%~dp0"

set "AP_PORT=8110"
set "AP_HOST=0.0.0.0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] 找不到 node，請先安裝 Node.js 再重試。
  echo.
  pause
  exit /b 1
)

if defined AP_DRYRUN (
  echo DRYRUN HOST=%AP_HOST% PORT=%AP_PORT% ROOT=%CD%
  exit /b 0
)

echo.
echo   手機請連同一個 WiFi，用下面的「區網」網址開啟。
echo   注意：區網是 http，Google 只允許 https / localhost 登入，
echo         所以手機上請用「本機」與「音樂庫」來源；
echo         要在手機上放 Drive 音檔請部署到 GitHub Pages（見 README）。
echo.

node server.js

echo.
echo   伺服器已結束。
pause
