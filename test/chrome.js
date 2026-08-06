// 找無頭測試用的 Chrome（Windows / macOS / Linux 都能跑）
// Windows 上優先沿用 K:\Html5\helper\paths 這個單一事實來源；不在那台機器就退回常見安裝位置。
const fs = require('fs');

function candidates() {
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    ];
  }
  if (process.platform === 'win32') {
    const list = [];
    try { list.push(require('K:/Html5/helper/paths').CHROME); } catch (e) {}
    for (const base of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
      if (base) list.push(base + '\\Google\\Chrome\\Application\\chrome.exe',
                          base + '\\Microsoft\\Edge\\Application\\msedge.exe');
    }
    return list;
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
          '/usr/bin/chromium-browser', '/snap/bin/chromium'];
}

/** 回傳可執行檔路徑；找不到就丟清楚的錯（順便告訴使用者怎麼指定） */
function findChrome() {
  if (process.env.AP_CHROME && fs.existsSync(process.env.AP_CHROME)) return process.env.AP_CHROME;
  for (const c of candidates()) if (c && fs.existsSync(c)) return c;
  throw new Error('找不到 Chrome。請安裝 Google Chrome，或用環境變數指定：AP_CHROME=/路徑/到/chrome');
}

module.exports = { findChrome, candidates };
