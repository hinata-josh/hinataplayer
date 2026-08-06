// audioplayer 本機伺服器（node 與 bun 都能跑）
//   - 靜態檔：/ → hinataplayer.html（同一個檔就是 GitHub Pages 上的線上版；index.html 只是轉址）
//   - /api/local：掃 music\ 底下的音檔給「🗂️ 音樂庫」用
//   - 音檔支援 HTTP Range（不支援的話拖進度條會直接斷掉）
// localhost 是安全來源，Google 登入(GIS)才會放行；區網 http:// 只能用本機/音樂庫模式。
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.AP_PORT) || 8110;
const HOST = process.env.AP_HOST || '127.0.0.1';   // 手機連線.bat 會傳 0.0.0.0
const ROOT = __dirname;
const MUSIC = path.join(ROOT, 'music');

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.m4b', '.aac', '.ogg', '.oga', '.opus', '.flac', '.weba', '.webm', '.mp4', '.aiff', '.aif', '.wma', '.amr', '.mid', '.midi']);
const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.m4b': 'audio/mp4', '.aac': 'audio/aac',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac',
  '.weba': 'audio/webm', '.webm': 'audio/webm', '.mp4': 'audio/mp4', '.aiff': 'audio/aiff', '.aif': 'audio/aiff',
  '.wma': 'audio/x-ms-wma', '.amr': 'audio/amr', '.mid': 'audio/midi', '.midi': 'audio/midi',
};

/** 遞迴掃 music\，回傳相對路徑清單 */
function scanMusic(dir, rel, out, depth) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (depth < 8) scanMusic(abs, r, out, depth + 1); continue; }
    if (!AUDIO_EXT.has(path.extname(e.name).toLowerCase())) continue;
    let size = 0;
    try { size = fs.statSync(abs).size; } catch (x) {}
    out.push({ name: e.name, rel: r, dir: rel, size });
  }
  return out;
}

function sendFile(req, res, file) {
  const st = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };

  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m) {
    let start = m[1] === '' ? null : Number(m[1]);
    let end = m[2] === '' ? null : Number(m[2]);
    if (start === null) { start = Math.max(0, st.size - (end || 0)); end = st.size - 1; }   // bytes=-N
    if (end === null || end >= st.size) end = st.size - 1;
    if (start > end || start >= st.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return;
    }
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...base, 'Content-Length': st.size });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
}

const srv = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { p = '/'; }
  if (p === '/' || p === '/index.html' || p === '/audioplayer.html') p = '/hinataplayer.html';

  if (p === '/api/local') {
    const files = fs.existsSync(MUSIC) ? scanMusic(MUSIC, '', [], 0) : [];
    files.sort((a, b) => a.rel.localeCompare(b.rel, 'zh-Hant', { numeric: true }));
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ root: 'music', count: files.length, files }));
    return;
  }

  const file = path.join(ROOT, p.replace(/^[/\\]+/, ''));
  const norm = path.resolve(file);
  if (!norm.startsWith(path.resolve(ROOT)) || !fs.existsSync(norm) || fs.statSync(norm).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain;charset=utf-8' }); res.end('404 ' + p); return;
  }
  try { sendFile(req, res, norm); }
  catch (e) { res.writeHead(500, { 'Content-Type': 'text/plain;charset=utf-8' }); res.end('500 ' + e.message); }
});

srv.listen(PORT, HOST, () => {
  const lines = [`  🎵 Drive 音檔播放器`, ``, `  本機：http://localhost:${PORT}`];
  if (HOST === '0.0.0.0') {
    for (const [, arr] of Object.entries(os.networkInterfaces())) {
      for (const a of arr || []) if (a.family === 'IPv4' && !a.internal) lines.push(`  區網：http://${a.address}:${PORT}`);
    }
    lines.push(``, `  ※ 區網 http:// 不能用 Google 登入（Google 只允許 https 或 localhost）`, `     手機要放 Drive 音檔請部署到 GitHub Pages；區網模式可用「🗂️ 音樂庫」`);
  }
  lines.push(``, `  音樂庫目錄：${MUSIC}`, `  （Ctrl+C 結束）`, ``);
  console.log('\n' + lines.join('\n'));
});
srv.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `\n  ✗ 埠 ${PORT} 已被占用。先關掉舊視窗，或設 AP_PORT=其他埠。\n` : e);
  process.exit(1);
});
