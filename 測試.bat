@echo off
chcp 65001 >nul
title Drive 音檔播放器 - 自動測試
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] 找不到 node，請先安裝 Node.js 再重試。
  pause
  exit /b 1
)

echo.
echo   用無頭 Chrome 實跑整頁（含真的播放一段音檔），約 30 秒…
echo.

node test\verify.js
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (echo   全部通過。) else (echo   有項目失敗，離開碼 %RC%。)
if not "%1"=="ci" pause
exit /b %RC%
