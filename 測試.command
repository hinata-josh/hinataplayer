#!/bin/bash
# Hinata Player — macOS 自動測試（無頭 Chrome 實跑整頁，約 30 秒）
cd "$(dirname "$0")" || exit 1

RT=""
if command -v node >/dev/null 2>&1; then RT="$(command -v node)"; fi
for c in /opt/homebrew/bin/node /usr/local/bin/node "$HOME/.volta/bin/node"; do
  [ -z "$RT" ] && [ -x "$c" ] && RT="$c"
done
if [ -z "$RT" ]; then
  echo "[錯誤] 找不到 node（brew install node）。"
  read -n 1 -s -r -p "按任意鍵關閉…"
  exit 1
fi

"$RT" test/verify.js
RC=$?

echo ""
if [ "$RC" -eq 0 ]; then echo "全部通過。"; else echo "有項目失敗（離開碼 $RC）。"; fi
if [ "$1" != "ci" ]; then read -n 1 -s -r -p "按任意鍵關閉…"; fi
exit "$RC"
