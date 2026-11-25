/* 手機版面測試：CDP 真實手機模擬(390×844, mobile, 觸控) → 檢查不會左右溢出、底部迷你播放列可見可按、
   捲到清單時仍能暫停/播放/換下一首，最後輸出截圖。
   用法：node test\mobile.js [截圖輸出前綴]（預設 test\_mobile） */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { launch, sleep } = require('./cdp');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8117;
const PAGE = path.join(ROOT, 'test', '_mobile.html');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'test', '_mobile'));
const SIZES = ['390,844', '360,740'];

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
  } catch (e) {}
  window.__demoReady = true;
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

const R = [];
const T = (name, ok, msg) => { R.push({ name, ok: !!ok, msg: msg || '' }); };

async function tap(c, sel) {
  const r = await c.eval(`const e=document.querySelector(${JSON.stringify(sel)});const b=e.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`);
  await c.touch('touchStart', [r]); await sleep(40); await c.touch('touchEnd', []);
  await sleep(350);
}

async function one(size, idx) {
  const c = await launch(`http://localhost:${PORT}/test/_mobile.html`, { size, debugPort: 9340 + idx });
  try {
    await c.send('Page.reload'); await sleep(1500);
    for (let i = 0; i < 40 && !(await c.eval('return !!window.__demoReady')); i++) await sleep(150);
    const tag = `[${size}] `;
    const m = await c.eval(`
      const iw = innerWidth, sw = document.documentElement.scrollWidth;
      const wide = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > iw + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('#tracks,dialog,#toast'); }).slice(0,5).map(e => (e.id ? '#'+e.id : e.tagName + '.' + e.className) + ' r=' + Math.round(e.getBoundingClientRect().right));
      const mini = document.querySelector('#mini'), mb = mini.getBoundingClientRect();
      const pl = document.querySelector('#btnPlay').getBoundingClientRect();
      return { iw, sw, wide, miniShown: getComputedStyle(mini).display !== 'none', miniBottom: Math.round(mb.bottom), ih: innerHeight, playH: Math.round(pl.height) };`);
    T(tag + '頁面沒有左右溢出', m.sw <= m.iw + 1, `scrollWidth=${m.sw} innerWidth=${m.iw} ${m.wide.join(', ')}`);
    T(tag + '底部迷你播放列有顯示且貼底', m.miniShown && Math.abs(m.miniBottom - m.ih) <= 1, `bottom=${m.miniBottom} ih=${m.ih}`);
    T(tag + '主播放鍵沒被壓扁', m.playH >= 60, 'h=' + m.playH);
    await c.send('Page.captureScreenshot', { format: 'png' }).then((s) => fs.writeFileSync(`${OUT}-${idx}-top.png`, Buffer.from(s.data, 'base64')));

    // 捲到播放清單 → 主播放器已經在畫面外，用迷你列控制
    await c.eval(`document.querySelector('#pList').scrollIntoView({block:'start'}); return 1`); await sleep(300);
    const off = await c.eval(`return document.querySelector('#btnPlay').getBoundingClientRect().bottom < 0`);
    T(tag + '捲到清單時主播放鍵已在畫面外（情境成立）', off);
    await tap(c, '#mPlay'); await sleep(800);
    let st = await c.eval(`const a=document.querySelector('#au');return {paused:a.paused, now:document.querySelector('#mNow').textContent, btn:document.querySelector('#mPlay').textContent}`);
    T(tag + '點迷你列 ▶ 開始播放', !st.paused && st.btn === '⏸', JSON.stringify(st));
    const first = st.now;
    await tap(c, '#mPlay');
    st = await c.eval(`const a=document.querySelector('#au');return {paused:a.paused, btn:document.querySelector('#mPlay').textContent, main:document.querySelector('#btnPlay').textContent}`);
    T(tag + '點迷你列 ⏸ 暫停（主播放鍵同步）', st.paused && st.btn === '▶' && st.main === '▶', JSON.stringify(st));
    await tap(c, '#mNext'); await sleep(600);
    st = await c.eval(`return document.querySelector('#mNow').textContent`);
    T(tag + '點迷你列 ⏭ 換下一首', st && st !== first, `${first} → ${st}`);
    await c.send('Page.captureScreenshot', { format: 'png' }).then((s) => fs.writeFileSync(`${OUT}-${idx}-list.png`, Buffer.from(s.data, 'base64')));
    const tr = await c.eval(`const t=document.querySelectorAll('#tracks .tr')[2].getBoundingClientRect(); const m=document.querySelector('#mini').getBoundingClientRect(); return {ok: t.bottom <= m.top || t.top < m.top}`);
    T(tag + '清單曲目沒有被迷你列整個蓋住', tr.ok);
  } finally { await c.close(); }
}

(async () => {
  let code = 0;
  try {
    await sleep(700);
    for (let i = 0; i < SIZES.length; i++) await one(SIZES[i], i);
  } catch (e) { R.push({ name: '執行', ok: false, msg: e.message }); }
  srv.kill();
  try { fs.rmSync(PAGE); } catch (e) {}
  for (const r of R) console.log((r.ok ? '  ✔ ' : '  ✘ ') + r.name + (r.ok ? '' : '  → ' + r.msg));
  const bad = R.filter((r) => !r.ok).length;
  console.log(`\n手機測試：${R.length - bad}/${R.length} 通過；截圖 ${OUT}-*.png`);
  code = bad ? 1 : 0;
  process.exit(code);
})();
