#!/bin/bash
# Hinata Player — macOS 啟動器（在 Finder 雙擊即可）
# 首次使用若雙擊沒反應，先在終端機執行一次：
#   chmod +x "開啟播放器.command"
# 或用「右鍵 → 打開」繞過 Gatekeeper。

cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
PORT="${AP_PORT:-8110}"
URL="http://localhost:$PORT"

echo "🎵 Hinata Player — 啟動中…"

# === 找 node（或 bun）：PATH → 常見安裝位置 ===
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
  echo ""
  echo "[錯誤] 找不到 node。請先安裝其中一種："
  echo "    brew install node"
  echo "    # 或 https://nodejs.org 下載安裝檔"
  echo "（也接受 bun：curl -fsSL https://bun.sh/install | bash）"
  echo ""
  read -n 1 -s -r -p "按任意鍵關閉…"
  exit 1
fi

export AP_PORT="$PORT"
export AP_HOST="${AP_HOST:-127.0.0.1}"

"$RT" "$DIR/server.js" &
SRV=$!
trap 'kill "$SRV" 2>/dev/null' EXIT

sleep 1

# Google 登入只認 localhost / https，所以固定開 localhost 這個網址
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args "$URL" >/dev/null 2>&1 || open "$URL"
else
  # Safari 也可以，只是 ogg/opus 支援較差
  open "$URL"
fi

echo ""
echo "✅ 伺服器執行中： $URL"
echo "   要停止：關閉這個終端機視窗，或按 Ctrl+C。"
echo ""

wait "$SRV"
