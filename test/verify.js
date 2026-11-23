/* audioplayer 驗證：真的把頁面丟進無頭 Chrome 跑一遍（純語法檢查抓不到執行期錯誤）
   用法：node test\verify.js  [--keep]（--keep 保留臨時頁面與測試音檔）

   流程：
     1) 產生 music\__aptest__\tone.wav（3 秒 440Hz），供「真的播放」用
     2) 產生 test\_page.html＝audioplayer.html 去掉 GIS 外連 + 注入 driver.js
     3) 起 server.js（埠 8111）＋結果收集伺服器（埠 8112）
     4) headless Chrome 開頁面跑 driver.js，結果用 sendBeacon 回傳
     5) 另外在 node 端直接測 server.js 的 Range / 防穿越
*/
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHROME = require('./chrome').findChrome();
const PORT = 8111, COLLECT = 8112;
const PAGE = path.join(ROOT, 'test', '_page.html');
const TONE_DIR = path.join(ROOT, 'music', '__aptest__');
const TONE = path.join(TONE_DIR, 'tone.wav');
const KEEP = process.argv.includes('--keep');

const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[90m', b: '\x1b[1m', x: '\x1b[0m' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 1. 測試音檔 ---------- */
function makeTone(file, sec, hz, rate) {
  const n = Math.round(sec * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 12000), 44 + i * 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return buf.length;
}

/* ---------- 2. 臨時頁面 ---------- */
function buildPage() {
  let html = fs.readFileSync(path.join(ROOT, 'hinataplayer.html'), 'utf8');
  // 去掉 Google 外連（內網 / 無網路時會卡住 load），並塞一個 base 讓相對路徑仍指向站根
  html = html.replace(/<script src="https:\/\/accounts\.google\.com[^>]*><\/script>/, '<!-- GIS 已於測試中移除 -->');
  html = html.replace('<title>', `<base href="/">\n<title>`);
  html = html.replace('</body>', `<script src="/test/driver.js"></script>\n</body>`);
  fs.writeFileSync(PAGE, html, 'utf8');
  return html.length;
}

/* ---------- 3. 收集伺服器 ---------- */
function collector() {
  let resolve; const done = new Promise((r) => (resolve = r));
  const srv = http.createServer((req, res) => {
    if (req.method === 'POST' || req.method === 'OPTIONS') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); res.end();
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { resolve({ results: [{ g: 'collector', name: '結果解析失敗', ok: false, msg: e.message }] }); }
      });
      return;
    }
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); res.end('ok');
  });
  srv.listen(COLLECT, '127.0.0.1');
  return { srv, done };
}

/* ---------- 4. node 端直接驗 server.js ---------- */
function req(pathname, headers) {
  return new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: pathname, headers: headers || {} }, (x) => {
      const b = [];
      x.on('data', (c) => b.push(c));
      x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: Buffer.concat(b) }));
    });
    r.on('error', rej); r.end();
  });
}

async function serverTests(out) {
  const T = async (name, fn) => {
    try { const m = await fn(); out.push({ g: '0 伺服器 (node)', name, ok: m !== false, msg: typeof m === 'string' ? m : '' }); }
    catch (e) { out.push({ g: '0 伺服器 (node)', name, ok: false, msg: 'throw: ' + e.message }); }
  };
  await T('/ 回 hinataplayer.html', async () => {
    const r = await req('/');
    return r.status === 200 && r.body.toString('utf8', 0, 400).includes('Hinata Player');
  });
  await T('index.html 轉址到 hinataplayer.html（GitHub Pages 入口）', async () => {
    const s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    return s.includes('hinataplayer.html') || '沒有指向本體';
  });
  await T('線上版不依賴後端：頁面沒有外部相依（除 Google 登入）', async () => {
    const s = fs.readFileSync(path.join(ROOT, 'hinataplayer.html'), 'utf8');
    const ext = [...s.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
      .filter((u) => !/accounts\.google\.com|console\.cloud\.google\.com/.test(u));
    return ext.length === 0 || '外連：' + ext.join(', ');
  });
  await T('api/local 找得到測試音檔', async () => {
    const r = await req('/api/local');
    const j = JSON.parse(r.body.toString('utf8'));
    return j.files.some((f) => f.rel === '__aptest__/tone.wav') || '清單：' + j.count + ' 筆';
  });
  await T('api/local 也掃到 music\\ 裡真正的歌', async () => {
    const j = JSON.parse((await req('/api/local')).body.toString('utf8'));
    const real = j.files.filter((f) => !f.rel.includes('__aptest__'));
    return real.length > 0 ? `${real.length} 首` : '（music\\ 目前沒有其他音檔，略過）';
  });
  await T('音檔回應帶 Accept-Ranges 與正確 MIME', async () => {
    const r = await req('/music/__aptest__/tone.wav');
    return (r.headers['accept-ranges'] === 'bytes' && r.headers['content-type'] === 'audio/wav') ||
      `${r.headers['accept-ranges']} / ${r.headers['content-type']}`;
  });
  await T('Range 請求回 206 + 正確片段長度（拖進度條要靠這個）', async () => {
    const r = await req('/music/__aptest__/tone.wav', { Range: 'bytes=100-199' });
    return (r.status === 206 && r.body.length === 100 && /bytes 100-199\/\d+/.test(r.headers['content-range'])) ||
      `status=${r.status} len=${r.body.length} cr=${r.headers['content-range']}`;
  });
  await T('開放結尾 Range（bytes=N-）', async () => {
    const full = (await req('/music/__aptest__/tone.wav')).body.length;
    const r = await req('/music/__aptest__/tone.wav', { Range: 'bytes=' + (full - 50) + '-' });
    return (r.status === 206 && r.body.length === 50) || `status=${r.status} len=${r.body.length}`;
  });
  await T('尾端 Range（bytes=-N）', async () => {
    const r = await req('/music/__aptest__/tone.wav', { Range: 'bytes=-30' });
    return (r.status === 206 && r.body.length === 30) || `status=${r.status} len=${r.body.length}`;
  });
  await T('超出範圍的 Range 回 416', async () => {
    const r = await req('/music/__aptest__/tone.wav', { Range: 'bytes=999999999-' });
    return r.status === 416 || 'status=' + r.status;
  });
  await T('擋掉往上層目錄穿越', async () => {
    const r = await req('/../../windows/win.ini');
    return r.status === 404 || 'status=' + r.status;
  });
  await T('不存在的路徑回 404', async () => (await req('/nope.mp3')).status === 404);

  await T('區網模式（手機連線用）會印出 LAN 網址', async () => {
    const p = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
      cwd: ROOT, env: { ...process.env, AP_PORT: '8114', AP_HOST: '0.0.0.0' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    await sleep(900);
    p.kill();
    return out.includes('區網') || out.includes('localhost:8114') || '沒有輸出網址：' + out.trim();
  });

  // 跨平台啟動器：.bat 必須 CRLF（否則 cmd 變數不展開）、.command 必須 LF（否則 bash 壞掉）
  await T('Windows 啟動器是 CRLF', async () => {
    const bad = [];
    for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.bat'))) {
      const s = fs.readFileSync(path.join(ROOT, f), 'latin1');
      if (/[^\r]\n/.test(s)) bad.push(f);
    }
    return bad.length === 0 || '有裸 LF：' + bad.join(', ');
  });
  await T('macOS 啟動器是 LF 且有 shebang', async () => {
    const cmds = fs.readdirSync(ROOT).filter((x) => x.endsWith('.command'));
    if (!cmds.length) return '找不到 .command 啟動器';
    const bad = [];
    for (const f of cmds) {
      const s = fs.readFileSync(path.join(ROOT, f), 'latin1');
      if (s.includes('\r')) bad.push(f + '(CRLF)');
      if (!s.startsWith('#!/bin/bash')) bad.push(f + '(缺 shebang)');
    }
    return bad.length === 0 || bad.join(', ');
  });
  await T('測試腳本不硬綁 K:\\ 路徑（Mac clone 下來也能跑）', async () => {
    const bad = [];
    for (const f of ['verify.js', 'shot.js', 'driver.js']) {
      const s = fs.readFileSync(path.join(ROOT, 'test', f), 'utf8');
      if (/require\(['"]K:\//.test(s)) bad.push(f);
    }
    return bad.length === 0 || bad.join(', ') + ' 仍直接 require K:\\';
  });
  await T('頁面帶 Safari 回退（webkit AudioContext / FileReader / dialog）', async () => {
    const s = fs.readFileSync(path.join(ROOT, 'hinataplayer.html'), 'utf8');
    const miss = [];
    if (!s.includes('webkitAudioContext')) miss.push('webkitAudioContext');
    if (!s.includes('readAsArrayBuffer')) miss.push('FileReader 回退');
    if (!s.includes('showDlg')) miss.push('dialog 回退');
    if (!s.includes('webkitPreservesPitch')) miss.push('webkitPreservesPitch');
    return miss.length === 0 || '缺：' + miss.join(', ');
  });
}

/* ---------- 主流程 ---------- */
(async function main() {
  const bytes = makeTone(TONE, 3, 440, 44100);
  // ALAC（iPhone 語音備忘錄格式）素材：給頁內測試驗證「<audio> 播不動 → 前端解成 WAV」退路
  fs.copyFileSync(path.join(ROOT, 'test', 'fixtures', 'alac-s16-stereo.m4a'), path.join(TONE_DIR, 'alac.m4a'));
  const size = buildPage();
  console.log(`${C.d}測試音檔 ${bytes} bytes｜臨時頁面 ${size} bytes${C.x}`);

  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT, env: { ...process.env, AP_PORT: String(PORT), AP_HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let srvErr = '';
  srv.stderr.on('data', (d) => (srvErr += d));
  await sleep(700);
  if (srv.exitCode !== null) { console.error('server.js 起不來：' + srvErr); process.exit(2); }

  const col = collector();
  const profile = path.join(require('os').tmpdir(), 'ap-verify-profile');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    '--user-data-dir=' + profile, '--window-size=1280,900',
    `http://localhost:${PORT}/test/_page.html?collect=http://127.0.0.1:${COLLECT}/r`,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let chromeErr = '';
  chrome.stderr.on('data', (d) => (chromeErr += d));

  const payload = await Promise.race([col.done, sleep(90000).then(() => null)]);

  const results = [];
  await serverTests(results);
  for (const r of await require('./alac').run()) results.push({ g: '0 ALAC 解碼 / 轉檔（Node 端）', ...r });
  try { chrome.kill(); } catch (e) {}
  try { col.srv.close(); } catch (e) {}
  try { srv.kill(); } catch (e) {}
  if (!KEEP) {
    try { fs.rmSync(PAGE); } catch (e) {}
    try { fs.rmSync(TONE_DIR, { recursive: true, force: true }); } catch (e) {}
  }

  if (!payload) {
    console.error(`\n${C.r}✗ 瀏覽器沒有回傳結果（90 秒逾時）${C.x}`);
    console.error(chromeErr.split('\n').filter((l) => l && !/DevTools|Fontconfig|GPU|voice_transcription|Registration response|gcm|dbus/i.test(l)).slice(0, 25).join('\n'));
    process.exit(1);
  }
  results.push(...(payload.results || []));

  let pass = 0, fail = 0, skip = 0, lastG = '';
  for (const r of results) {
    if (r.g !== lastG) { console.log(`\n${C.b}${r.g}${C.x}`); lastG = r.g; }
    if (r.skip) { skip++; console.log(`  ${C.y}○${C.x} ${r.name} ${C.d}${r.msg}${C.x}`); }
    else if (r.ok) { pass++; console.log(`  ${C.g}✓${C.x} ${r.name}${r.msg ? C.d + '  ' + r.msg + C.x : ''}`); }
    else { fail++; console.log(`  ${C.r}✗ ${r.name}${C.x}  ${r.msg || ''}`); }
  }
  console.log(`\n${C.b}總計${C.x} ${C.g}${pass} 通過${C.x}｜${fail ? C.r : C.d}${fail} 失敗${C.x}｜${C.y}${skip} 跳過${C.x}`);
  if ((payload.errors || []).length) console.log(`${C.r}頁面 JS 錯誤：${C.x}\n  ` + payload.errors.join('\n  '));
  process.exit(fail ? 1 : 0);
})();
