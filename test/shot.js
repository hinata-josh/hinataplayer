/* 版面截圖：起 server → 產生一份帶示範清單的頁面 → headless Chrome 截圖
   用法：node test\shot.js [輸出.png]（預設 test\_shot.png） */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHROME = require('./chrome').findChrome();
const PORT = 8113;
const PAGE = path.join(ROOT, 'test', '_shot.html');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'test', '_shot.png'));

const DEMO = `
<script>
(async () => {
  const A = window.__ap;
  try {
    const j = await (await fetch('api/local')).json();
    const files = (j.files || []).slice(0, 14);
    A.setTracks(files.map((f) => ({ key: 's:' + f.rel, kind: 'server',
      url: 'music/' + f.rel.split('/').map(encodeURIComponent).join('/'),
      name: f.name, mime: '', size: f.size, path: f.dir, rel: f.rel })), '示範清單');
    A.S.plName = '客語練唱'; A.paintPlName();
    document.querySelector('#au').addEventListener('loadedmetadata', () => {
      const d = A.au.duration || 30;
      A.setRange(d * 0.25, d * 0.55, { on: true });
      A.setSpeed(0.5);
      try { A.au.currentTime = d * 0.34; } catch (e) {}
    }, { once: true });
  } catch (e) {}
})();
</script>`;

let html = fs.readFileSync(path.join(ROOT, 'hinataplayer.html'), 'utf8');
html = html.replace(/<script src="https:\/\/accounts\.google\.com[^>]*><\/script>/, '');
html = html.replace('<title>', '<base href="/">\n<title>');
html = html.replace('</body>', DEMO + '\n</body>');
fs.writeFileSync(PAGE, html, 'utf8');

const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  cwd: ROOT, env: { ...process.env, AP_PORT: String(PORT), AP_HOST: '127.0.0.1' }, stdio: 'ignore',
});

setTimeout(() => {
  const r = spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1440,1000', '--force-device-scale-factor=1',
    '--virtual-time-budget=9000', '--screenshot=' + OUT,
    '--user-data-dir=' + path.join(require('os').tmpdir(), 'ap-shot-profile'),
    `http://localhost:${PORT}/test/_shot.html`,
  ], { encoding: 'utf8' });
  srv.kill();
  try { fs.rmSync(PAGE); } catch (e) {}
  const okFile = fs.existsSync(OUT) && fs.statSync(OUT).size > 5000;
  console.log(okFile ? `截圖完成：${OUT}（${fs.statSync(OUT).size} bytes）` : `截圖失敗\n${r.stderr || ''}`);
  process.exit(okFile ? 0 : 1);
}, 900);
