#!/bin/bash
# Hinata Player — macOS 區網模式（手機同一個 WiFi 連進來）
# 注意：區網是 http://192.168.x.x，Google 不允許在這種來源登入，
#       所以手機走區網只能用「本機檔案」與「音樂庫」；
#       要在手機上放 Drive 音檔請用 GitHub Pages 版（見 README）。

cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
PORT="${AP_PORT:-8110}"

RT=""
if command -v node >/dev/null 2>&1; then RT="$(command -v node)"; fi
for c in /opt/homebrew/bin/node /usr/local/bin/node "$HOME/.volta/bin/node"; do
  [ -z "$RT" ] && [ -x "$c" ] && RT="$c"
done
if [ -z "$RT" ]; then
  if command -v bun >/dev/null 2>&1; then RT="$(command -v bun)"; fi
  for c in "$HOME/.bun/bin/bun" /opt/homebrew/bin/bun /usr/local/bin/bun; do
    [ -z "$RT" ] && [ -x "$c" ] && RT="$c"
  done
fi
if [ -z "$RT" ]; then
  echo "[錯誤] 找不到 node（brew install node）。"
  read -n 1 -s -r -p "按任意鍵關閉…"
  exit 1
fi

export AP_PORT="$PORT"
export AP_HOST="0.0.0.0"

echo "📱 手機請連同一個 WiFi，用下面印出來的「區網」網址開啟。"
echo ""

"$RT" "$DIR/server.js"

echo ""
read -n 1 -s -r -p "伺服器已結束，按任意鍵關閉…"
