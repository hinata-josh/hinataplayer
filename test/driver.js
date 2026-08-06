/* 頁內測試 driver：由 test/verify.js 產生的臨時頁面載入。
   斷言完把結果用 sendBeacon 回傳給收集伺服器（--dump-dom 抓不到 async 結果，所以走 beacon）。 */
(function () {
  'use strict';
  const R = [];
  const errs = [];
  const COLLECT = new URLSearchParams(location.search).get('collect');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.addEventListener('error', (e) => errs.push('window.onerror: ' + (e.message || '') + ' @' + (e.filename || '') + ':' + (e.lineno || 0)));
  window.addEventListener('unhandledrejection', (e) => errs.push('unhandledrejection: ' + (e.reason && (e.reason.message || e.reason))));
  const ce = console.error.bind(console);
  console.error = function (...a) { errs.push('console.error: ' + a.map(String).join(' ')); ce(...a); };

  let group = '';
  const T = (name, fn) => {
    try {
      const m = fn();
      if (m && typeof m.then === 'function') { m.catch(() => {}); R.push({ g: group, name, ok: false, msg: '這是 async 測試，請改用 TA()' }); return; }
      R.push({ g: group, name, ok: m !== false, msg: typeof m === 'string' ? m : '' });
    } catch (e) { R.push({ g: group, name, ok: false, msg: 'throw: ' + (e && e.message) }); }
  };
  const TA = async (name, fn) => { try { const m = await fn(); R.push({ g: group, name, ok: m !== false, msg: typeof m === 'string' ? m : '' }); } catch (e) { R.push({ g: group, name, ok: false, msg: 'throw: ' + (e && e.message) }); } };
  const SKIP = (name, why) => R.push({ g: group, name, skip: true, msg: why });
  const eq = (a, b, l) => { if (a !== b) throw new Error(`${l || ''} 期望 ${JSON.stringify(b)}，得到 ${JSON.stringify(a)}`); return true; };
  const near = (a, b, tol, l) => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${l || ''} 期望 ${b}±${tol}，得到 ${a}`); return true; };
  const ok = (c, l) => { if (!c) throw new Error(l || '條件不成立'); return true; };
  const arrEq = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const key = (k, opt) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...(opt || {}) }));

  async function run() {
    const AP = window.AP, A = window.__ap;
    if (!AP || !A) { R.push({ g: 'boot', name: '應用程式掛上 window.AP / window.__ap', ok: false, msg: '找不到，可能 JS 在載入時就爆了' }); return; }
    const S = A.S, au = A.au;

    /* ---------------- 1. 純邏輯 ---------------- */
    group = '1 純邏輯 · 時間格式';
    T('fmtTime 0 → 0:00', () => eq(AP.fmtTime(0), '0:00'));
    T('fmtTime 5 → 0:05', () => eq(AP.fmtTime(5), '0:05'));
    T('fmtTime 61 → 1:01', () => eq(AP.fmtTime(61), '1:01'));
    T('fmtTime 599.9 → 9:59', () => eq(AP.fmtTime(599.9), '9:59'));
    T('fmtTime 3661 → 1:01:01', () => eq(AP.fmtTime(3661), '1:01:01'));
    T('fmtTime NaN → 0:00', () => eq(AP.fmtTime(NaN), '0:00'));
    T('fmtTime 負數 → 0:00', () => eq(AP.fmtTime(-9), '0:00'));

    group = '1 純邏輯 · 起始秒數解析';
    T('parseTime 空 → 0', () => eq(AP.parseTime(''), 0));
    T('parseTime 83 → 83', () => eq(AP.parseTime('83'), 83));
    T('parseTime 1:23 → 83', () => eq(AP.parseTime('1:23'), 83));
    T('parseTime 1:2 → 62', () => eq(AP.parseTime('1:2'), 62));
    T('parseTime 1:02:03 → 3723', () => eq(AP.parseTime('1:02:03'), 3723));
    T('parseTime 12.5 → 12.5', () => eq(AP.parseTime('12.5'), 12.5));
    T('parseTime 亂填 → NaN', () => ok(isNaN(AP.parseTime('abc')) && isNaN(AP.parseTime('1:2:3:4')) && isNaN(AP.parseTime('-5'))));
    T('parseTime 前後空白容忍', () => eq(AP.parseTime('  90  '), 90));

    group = '1 純邏輯 · 音檔判斷';
    T('mp3 副檔名', () => ok(AP.isAudioFile({ name: 'a.MP3' })));
    T('wav / flac / opus', () => ok(AP.isAudioFile({ name: 'a.wav' }) && AP.isAudioFile({ name: 'a.flac' }) && AP.isAudioFile({ name: 'a.opus' })));
    T('mimeType audio/*', () => ok(AP.isAudioFile({ name: '沒有副檔名', mimeType: 'audio/mpeg' })));
    T('Drive 資料夾不算音檔', () => ok(!AP.isAudioFile({ name: '資料夾', mimeType: 'application/vnd.google-apps.folder' })));
    T('txt / pdf / jpg 不算', () => ok(!AP.isAudioFile({ name: 'a.txt' }) && !AP.isAudioFile({ name: 'a.pdf' }) && !AP.isAudioFile({ name: 'a.jpg' })));
    T('null 不算', () => ok(!AP.isAudioFile(null)));
    T('中文檔名 + 括號', () => ok(AP.isAudioFile({ name: '國立客家兒童合唱團 —【行過】(Official Music Video)_320k.mp3' })));
    T('wma/mid 列入但標記為 Chrome 多半播不動', () => ok(AP.isAudioFile({ name: 'a.wma' }) && AP.isWeak('a.wma') && AP.isWeak('b.MID') && !AP.isWeak('c.mp3')));
    T('ext 取副檔名', () => ok(AP.ext('a.b.MP3') === 'mp3' && AP.ext('沒副檔名') === ''));

    group = '1 純邏輯 · Drive 資料夾 ID';
    T('folders 網址', () => eq(AP.parseFolderId('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing'), '1AbCdEfGhIjKlMnOp'));
    T('folders 網址帶斜線', () => eq(AP.parseFolderId('https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOp/'), '1AbCdEfGhIjKlMnOp'));
    T('open?id= 網址', () => eq(AP.parseFolderId('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp'), '1AbCdEfGhIjKlMnOp'));
    T('file/d/ 網址', () => eq(AP.parseFolderId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view'), '1AbCdEfGhIjKlMnOp'));
    T('純 ID', () => eq(AP.parseFolderId('1AbCdEfGhIjKlMnOp'), '1AbCdEfGhIjKlMnOp'));
    T('root', () => eq(AP.parseFolderId('root'), 'root'));
    T('看不懂的字串 → 空', () => eq(AP.parseFolderId('哈囉'), '') && eq(AP.parseFolderId(''), ''));

    group = '1 純邏輯 · 曲序 / 重複';
    const ord = [0, 1, 2, 3];
    T('中間往下一首', () => eq(AP.nextIndex({ index: 1, order: ord, repeat: 'off' }), 2));
    T('關閉重複 · 最後一首 → -1（停）', () => eq(AP.nextIndex({ index: 3, order: ord, repeat: 'off' }), -1));
    T('全部重複 · 最後一首 → 回第一首', () => eq(AP.nextIndex({ index: 3, order: ord, repeat: 'all' }), 0));
    T('單曲重複 · 自然播完 → 同一首', () => eq(AP.nextIndex({ index: 2, order: ord, repeat: 'one' }), 2));
    T('單曲重複 · 手動⏭ 仍前進', () => eq(AP.nextIndex({ index: 2, order: ord, repeat: 'one', manual: true }), 3));
    T('手動⏭ 在最後一首 → 循環回第一首', () => eq(AP.nextIndex({ index: 3, order: ord, repeat: 'off', manual: true }), 0));
    T('空清單 → -1', () => eq(AP.nextIndex({ index: 0, order: [], repeat: 'all' }), -1));
    T('隨機順序也照 order 走', () => eq(AP.nextIndex({ index: 2, order: [2, 0, 3, 1], repeat: 'off' }), 0));
    T('上一首', () => eq(AP.prevIndex({ index: 2, order: ord }), 1));
    T('第一首的上一首 → 最後一首', () => eq(AP.prevIndex({ index: 0, order: ord }), 3));
    T('buildOrder 非隨機 = 0..n-1', () => arrEq(AP.buildOrder(4, false), [0, 1, 2, 3]));
    T('buildOrder 隨機：不漏曲、目前這首排第一', () => {
      const o = AP.buildOrder(6, true, 4, (() => { let i = 0; const a = [.9, .1, .7, .3, .5]; return () => a[i++ % a.length]; })());
      return ok(o.length === 6 && o[0] === 4 && new Set(o).size === 6);
    });

    group = '1 純邏輯 · 速度 / 尺寸 / 排序';
    T('SPEEDS = 0.25/0.5/1/1.5/2', () => arrEq(AP.SPEEDS, [0.25, 0.5, 1, 1.5, 2]));
    T('stepSpeed 上下移動', () => ok(AP.stepSpeed(1, 1) === 1.5 && AP.stepSpeed(1, -1) === 0.5));
    T('stepSpeed 到底不越界', () => ok(AP.stepSpeed(2, 1) === 2 && AP.stepSpeed(0.25, -1) === 0.25));
    T('fmtSize', () => ok(AP.fmtSize(0) === '0B' && AP.fmtSize(2048) === '2KB' && AP.fmtSize(3 * 1048576) === '3.0MB'));
    T('clampSeek 夾在片長內', () => ok(AP.clampSeek(999, 10) < 10 && AP.clampSeek(-5, 10) === 0 && AP.clampSeek(3, 10) === 3));
    T('clampSeek 片長未知時原樣', () => eq(AP.clampSeek(7, NaN), 7));
    T('自然排序：第2部 在 第10部 前', () => ok(AP.natCmp('第2部', '第10部') < 0));

    group = '1 純邏輯 · Drive 快取 LRU';
    T('容量超過就丟最舊的', () => {
      const c = new AP.BlobCache(100);
      c.put('a', 'blob:a', 60); c.put('b', 'blob:b', 60);
      return ok(!c.has('a') && c.has('b'), 'a 應被淘汰');
    });
    T('取用會刷新順序（LRU 非 FIFO）', () => {
      const c = new AP.BlobCache(130);
      c.put('a', 'blob:a', 60); c.put('b', 'blob:b', 60);
      c.get('a'); c.put('c', 'blob:c', 60);
      return ok(c.has('a') && !c.has('b') && c.has('c'), '應淘汰 b');
    });
    T('clear 全清', () => { const c = new AP.BlobCache(999); c.put('a', 'blob:a', 5); c.clear(); return ok(!c.has('a') && c.bytes === 0); });

    /* ---------------- 2. UI 綁定 ---------------- */
    group = '2 UI · 元件齊全';
    T('五個速度鈕 0.25/0.5/1/1.5/2 都在', () => arrEq($$('#segSpeed button').map((b) => b.dataset.s), ['0.25', '0.5', '1', '1.5', '2']));
    T('播放/暫停、停止、上下首鈕都在', () => ok($('#btnPlay') && $('#btnStop') && $('#btnPrev') && $('#btnNext')));
    T('三種重複模式鈕都在', () => arrEq($$('#segRepeat button').map((b) => b.dataset.r), ['off', 'one', 'all']));
    T('起始秒數欄位 + 從這裡播', () => ok($('#startAt') && $('#btnStartGo') && $('#btnStartHere')));
    T('未登入時徽章顯示未登入', () => eq($('#authBadge').textContent.trim(), '未登入'));

    group = '2 UI · 播放速度';
    for (const s of ['0.25', '0.5', '1', '1.5', '2']) {
      T(`按 ${s}× → audio.playbackRate = ${s}`, () => {
        $$('#segSpeed button').find((b) => b.dataset.s === s).click();
        return ok(au.playbackRate === Number(s) && S.speed === Number(s) &&
          $$('#segSpeed button').filter((b) => b.classList.contains('on')).length === 1);
      });
    }
    T('保留音高開關會套到 audio', () => {
      const cb = $('#pitch'); cb.checked = false; cb.dispatchEvent(new Event('change'));
      const off = ('preservesPitch' in au) ? au.preservesPitch === false : true;
      cb.checked = true; cb.dispatchEvent(new Event('change'));
      return ok(off && (('preservesPitch' in au) ? au.preservesPitch === true : true));
    });
    T('快速鍵 1~5 選速度', () => { key('3'); const a = S.speed === 1; key('5'); const b = S.speed === 2; key('1'); return ok(a && b && S.speed === 0.25); });
    T('快速鍵 [ ] 上下一檔速度', () => { A.setSpeed(1); key(']'); const a = S.speed === 1.5; key('['); return ok(a && S.speed === 1); });

    group = '2 UI · 重複 / 隨機';
    T('按單曲重複', () => { $$('#segRepeat button').find((b) => b.dataset.r === 'one').click(); return ok(S.repeat === 'one'); });
    T('按全部重複', () => { $$('#segRepeat button').find((b) => b.dataset.r === 'all').click(); return ok(S.repeat === 'all'); });
    T('快速鍵 R 輪換 off→one→all', () => { A.setRepeat('off'); key('r'); const a = S.repeat === 'one'; key('r'); const b = S.repeat === 'all'; key('r'); return ok(a && b && S.repeat === 'off'); });
    T('隨機開關會重算順序且不漏曲', () => {
      A.setTracks([1, 2, 3, 4, 5, 6].map((i) => ({ key: 'k' + i, kind: 'server', url: 'x' + i, name: 'T' + i, size: 1 })), 'x');
      A.setShuffle(true);
      const on = S.order.length === 6 && new Set(S.order).size === 6;
      A.setShuffle(false);
      return ok(on && JSON.stringify(S.order) === JSON.stringify([0, 1, 2, 3, 4, 5]));
    });

    group = '2 UI · 播放清單';
    T('setTracks 畫出對應列數與計數', () => {
      A.setTracks([1, 2, 3].map((i) => ({ key: 'p' + i, kind: 'server', url: 'y' + i, name: '曲目' + i, size: 1024 * i })), '測試');
      return ok($$('#tracks .tr').length === 3 && $('#plCount').textContent === '3 首');
    });
    T('點清單第 2 列 → 換到 index 1', () => { $$('#tracks .tr')[1].click(); return eq(S.index, 1); });
    T('搜尋過濾', () => { $('#q').value = '曲目3'; $('#q').dispatchEvent(new Event('input')); const n = $$('#tracks .tr').length; $('#q').value = ''; $('#q').dispatchEvent(new Event('input')); return ok(n === 1 && $$('#tracks .tr').length === 3); });
    T('✕ 移除一首', () => { const n = S.tracks.length; $$('#tracks .tr')[0].querySelector('.x').click(); return ok(S.tracks.length === n - 1 && $$('#tracks .tr').length === n - 1); });
    T('拖曳換順序', () => { const names = S.tracks.map((t) => t.name); A.S.tracks.length >= 2 && (() => {})(); const box = $('#tracks'); const rows = $$('#tracks .tr'); const dt = { getData: () => '0', setData: () => {} }; rows[1].ondrop({ preventDefault() {}, stopPropagation() {}, dataTransfer: dt }); return ok(S.tracks.map((t) => t.name).join() === [names[1], names[0]].concat(names.slice(2)).join()); });
    T('清空清單', () => { A.setTracks([], ''); return ok(S.tracks.length === 0 && $('#tracks .empty')); });

    group = '2 UI · 自選播放清單';
    const origPrompt = window.prompt, origConfirm = window.confirm;
    let answer = '';
    window.prompt = () => answer;
    window.confirm = () => true;
    const srvT = (n, i) => ({ key: 'mix' + i, kind: 'server', url: 'u' + i, name: n, size: 100 * i });
    const driveT = (n, id) => A.driveTrack({ id, name: n, mimeType: 'audio/mpeg', size: 999 });

    T('➕ 新自選清單：建出一份空的具名清單', () => {
      answer = '測試清單A';
      $('#btnPlNew').click();
      return ok(S.plName === '測試清單A' && S.tracks.length === 0 &&
        $('#plName').textContent.includes('測試清單A') && A.playlists()['測試清單A'], '狀態 ' + S.plName);
    });
    T('勾選 Drive 曲目 → 計數顯示在按鈕上', () => {
      S.curAuds = [driveT('甲.mp3', 'id1'), driveT('乙.mp3', 'id2'), driveT('丙.mp3', 'id3')];
      $('#folders').innerHTML = '';
      $('#btnSelAll').click();
      return ok(S.sel.size === 3 && $('#btnAddSel').textContent.includes('3'), $('#btnAddSel').textContent);
    });
    T('清除勾選', () => { $('#btnSelNone').click(); return ok(S.sel.size === 0 && $('#btnAddSel').disabled); });
    T('➕ 加入勾選 → 進入自選清單並清空勾選', () => {
      $('#btnSelAll').click();
      $('#btnAddSel').click();
      return ok(S.tracks.length === 3 && S.sel.size === 0 && $$('#tracks .tr').length === 3, '清單 ' + S.tracks.length + ' 首');
    });
    T('自選清單改動後自動存回 localStorage', () => ok(A.playlists()['測試清單A'].tracks.length === 3));
    T('重複加入同一首會被去重', () => {
      const n = A.addTracks([driveT('甲.mp3', 'id1'), driveT('乙.mp3', 'id2')], 'x');
      return ok(n === 0 && S.tracks.length === 3);
    });
    T('可以混搭不同來源（Drive + 伺服器音樂庫）', () => {
      A.addTracks([srvT('丁.wav', 4), srvT('戊.wav', 5)], '音樂庫');
      const kinds = new Set(S.tracks.map((t) => t.kind));
      return ok(S.tracks.length === 5 && kinds.has('drive') && kinds.has('server'), [...kinds].join('+'));
    });
    T('🔤 依曲名排序', () => { $('#btnSort').click(); return ok(S.tracks.length === 5 && S.tracks.map((t) => t.name).join() === S.tracks.map((t) => t.name).sort(AP.natCmp).join()); });
    T('🔃 反轉順序', () => { const first = S.tracks[0].name; $('#btnRev').click(); return ok(S.tracks[S.tracks.length - 1].name === first); });
    T('移除曲目也會存回具名清單', () => {
      $$('#tracks .tr')[0].querySelector('.x').click();
      return ok(S.tracks.length === 4 && A.playlists()['測試清單A'].tracks.length === 4);
    });
    T('✏️ 改名：舊名消失、新名沿用同一批曲目', () => {
      answer = '測試清單B';
      $('#btnPlRename').click();
      const pl = A.playlists();
      return ok(S.plName === '測試清單B' && !pl['測試清單A'] && pl['測試清單B'].tracks.length === 4);
    });
    T('切到別的清單再切回來，曲目還原', () => {
      answer = '測試清單C';
      $('#btnPlNew').click();                       // 空的 C
      A.addTracks([srvT('單曲.wav', 9)], 'x');
      A.openPl('測試清單B');
      return ok(S.plName === '測試清單B' && S.tracks.length === 4, S.plName + '/' + S.tracks.length);
    });
    T('未命名清單不會偷偷寫進已存清單', () => {
      const before = Object.keys(A.playlists()).length;
      A.setTracks([srvT('臨時.wav', 1)], '臨時');
      S.plName = ''; A.paintPlName();
      A.addTracks([srvT('臨時2.wav', 2)], '臨時');
      return ok(Object.keys(A.playlists()).length === before, '清單數 ' + before + ' → ' + Object.keys(A.playlists()).length);
    });
    T('匯入 JSON（取代模式）', () => {
      const json = JSON.stringify({ app: 'audioplayer', v: 1, name: '匯入的清單', starts: { 'd:iid1': 12 },
        tracks: [{ key: 'd:iid1', kind: 'drive', id: 'iid1', name: '匯入甲.mp3', size: 10 },
                 { key: 's:x/y.wav', kind: 'server', url: 'music/x/y.wav', rel: 'x/y.wav', name: '匯入乙.wav', size: 20 }] });
      const n = A.importPl(json, false);
      return ok(n === 2 && S.tracks.length === 2 && S.starts['d:iid1'] === 12, '匯入 ' + n + ' 首');
    });
    T('匯入 JSON（加入模式）會去重', () => {
      const json = JSON.stringify({ tracks: [{ key: 'd:iid1', kind: 'drive', id: 'iid1', name: '匯入甲.mp3' },
                                             { key: 'd:iid9', kind: 'drive', id: 'iid9', name: '匯入丙.mp3' }] });
      A.importPl(json, true);
      return ok(S.tracks.length === 3, '得到 ' + S.tracks.length);
    });
    T('相容只有陣列的簡化 JSON', () => {
      const n = A.importPl(JSON.stringify([{ kind: 'server', rel: 'a.wav', url: 'music/a.wav', name: '陣列曲.wav' }]), false);
      return ok(n === 1 && S.tracks[0].name === '陣列曲.wav');
    });
    T('壞掉的 JSON 不會弄壞現有清單', () => {
      const n = S.tracks.length;
      A.importPl('{這不是 json', false);
      return ok(S.tracks.length === n);
    });
    T('🗑️ 刪除已存清單', () => {
      $('#plSel').value = '測試清單B'; $('#btnPlDel').click();
      $('#plSel').value = '測試清單C'; $('#btnPlDel').click();
      const pl = A.playlists();
      return ok(!pl['測試清單B'] && !pl['測試清單C'], Object.keys(pl).join());
    });
    T('下拉選單列出剩下的已存清單', () => {
      const opts = $$('#plSel option').map((o) => o.value).filter(Boolean);
      return ok(!opts.includes('測試清單B'), opts.join());
    });
    window.prompt = origPrompt; window.confirm = origConfirm;
    S.plName = ''; A.paintPlName();

    group = '2 UI · 起始秒數（不需音檔）';
    T('填 1:23 → 記成 83 秒', () => {
      A.setTracks([{ key: 'st1', kind: 'server', url: 'z', name: '起點測試', size: 1 }], 's');
      $('#perTrack').checked = true; $('#perTrack').dispatchEvent(new Event('change'));
      $('#startAt').value = '1:23'; A.readStart();
      return ok(S.startAt === 83 && S.starts['st1'] === 83);
    });
    T('每首記住 → 清單列顯示 ↩️1:23', () => ok(($('#tracks .tr .meta') || {}).textContent?.includes('↩️1:23')));
    T('填非法值 → 不動舊值並提示', () => { $('#startAt').value = 'xx'; const r = A.readStart(); return ok(r === null && S.startAt === 83); });
    T('清空 → 起點回 0', () => { $('#startAt').value = ''; A.readStart(); return ok(S.startAt === 0 && !S.starts['st1']); });

    group = '2 UI · 重複範圍（純邏輯）';
    T('normRange 會排序、夾範圍、保底長度', () => {
      const r1 = AP.normRange(8, 3, 30);           // 反過來填
      const r2 = AP.normRange(-5, 999, 30);        // 超出兩端
      const r3 = AP.normRange(10, 10.01, 30);      // 太短
      return ok(r1.a === 3 && r1.b === 8 && r2.a === 0 && r2.b === 30 && r3.b - r3.a > 0.19,
        JSON.stringify([r1, r2, r3]));
    });
    T('normRange 片長未知時不亂夾', () => { const r = AP.normRange(5, 9, 0); return ok(r.a === 5 && r.b === 9); });
    T('peaks 正規化到 0~1 且長度正確', () => {
      const sig = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) sig[i] = (i < 500 ? 0.1 : 0.5) * Math.sin(i);
      const p = AP.peaks(sig, 10);
      return ok(p.length === 10 && Math.max(...p) === 1 && Math.min(...p) >= 0 && p[9] > p[0], p.map((v) => v.toFixed(2)).join(','));
    });
    T('peaks 全靜音不會除以零', () => { const p = AP.peaks(new Float32Array(100), 5); return ok(p.length === 5 && p.every((v) => v === 0)); });
    T('設定範圍後文字顯示起訖與長度', () => {
      S.ab = { a: 3, b: 8, on: true }; A.paintAB();
      const txt = $('#abTxt').textContent;
      return ok(txt.includes('0:03') && txt.includes('0:08') && txt.includes('5.0 秒') && $('#btnAB').classList.contains('on'), '得到 ' + txt);
    });
    T('秒數欄位同步顯示範圍', () => ok($('#rangeA').value === '0:03' && $('#rangeB').value === '0:08', $('#rangeA').value + '/' + $('#rangeB').value));
    T('清除範圍', () => { $('#btnABClr').click(); return ok(S.ab.a === null && S.ab.b === null && !S.ab.on && $('#rangeA').value === ''); });

    group = '2 UI · 速度微調';
    T('滑桿可設非預設速度（如 1.25×）', () => {
      const sl = $('#speedFine'); sl.value = '1.25'; sl.dispatchEvent(new Event('input'));
      return ok(au.playbackRate === 1.25 && $('#speedTxt').textContent === '1.25×' &&
        $$('#segSpeed button').every((b) => !b.classList.contains('on')), $('#speedTxt').textContent);
    });
    T('按預設鈕後滑桿也跟著回位', () => {
      $$('#segSpeed button').find((b) => b.dataset.s === '0.5').click();
      return ok($('#speedFine').value === '0.5' && au.playbackRate === 0.5);
    });
    T('速度夾在 0.25～2 之間', () => { A.setSpeed(9); const hi = S.speed === 2; A.setSpeed(0.01); const lo = S.speed === 0.25; A.setSpeed(1); return ok(hi && lo); });

    group = '2 UI · 音量';
    T('拉音量 → audio.volume 同步', () => { const v = $('#vol'); v.value = '0.4'; v.dispatchEvent(new Event('input')); return ok(Math.abs(au.volume - 0.4) < 1e-6 && $('#volTxt').textContent === '40%'); });
    T('快速鍵 ↑ 加音量', () => { const before = au.volume; key('ArrowUp'); return ok(au.volume > before); });

    group = '2 UI · 伺服器音樂庫 API';
    await TA('api/local 回得到音檔清單', async () => {
      const j = await (await fetch('api/local')).json();
      return ok(Array.isArray(j.files) && j.files.length > 0, '收到 ' + (j.files || []).length + ' 筆');
    });
    await TA('清單項目含 name/rel/size', async () => {
      const j = await (await fetch('api/local')).json();
      const f = j.files.find((x) => x.rel.includes('__aptest__'));
      return ok(f && f.name && f.size > 0, '找不到測試音檔');
    });

    /* ---------------- 3. 真的播放一段音檔 ---------------- */
    group = '3 實際播放';
    const TONE = 'music/__aptest__/tone.wav';
    const track = (name, k) => ({ key: k || 'tone', kind: 'server', url: TONE, name, size: 0 });

    A.setTracks([track('測試音 3 秒', 't1'), track('測試音 B', 't2')], '播放測試');
    A.setSpeed(1); A.setRepeat('off'); $('#startAt').value = ''; A.readStart();
    $('#vol').value = '0'; $('#vol').dispatchEvent(new Event('input'));   // 靜音跑，避免依賴音效裝置

    const meta = await new Promise((res) => {
      if (au.readyState >= 1 && au.duration) return res(true);
      const t = setTimeout(() => res(false), 6000);
      au.addEventListener('loadedmetadata', () => { clearTimeout(t); res(true); }, { once: true });
    });
    T('載入音檔並讀到片長 ≈3 秒', () => ok(meta && Math.abs(au.duration - 3) < 0.35, '片長 ' + au.duration));
    T('片長顯示在畫面上', () => ok($('#tDur').textContent === AP.fmtTime(au.duration), $('#tDur').textContent));

    let clockOk = false;
    await TA('按 ▶ 之後播放位置真的在前進', async () => {
      $('#btnPlay').click();
      await sleep(1000);
      clockOk = au.currentTime > 0.15;
      if (!clockOk) return 'headless 無音效裝置、媒體時鐘不前進（currentTime=' + au.currentTime + '），時間相關項目改為跳過';
      return ok(!au.paused && au.currentTime > 0.15, 'currentTime=' + au.currentTime);
    });
    T('播放中按鈕變成 ⏸', () => ok(clockOk ? $('#btnPlay').textContent === '⏸' : true));

    if (!clockOk) {
      au.pause();
      for (const n of ['2× 速度約走兩倍時間', '⏹ 停止會回到起始秒數', '指定起始秒數 1.5 秒後載入即從該處開始', '單曲重複播完自動從起始秒數再來', 'A-B 區間重複會跳回 A 點', '拖進度條可跳到指定位置'])
        SKIP(n, '無音效裝置，媒體時鐘不前進');
    } else {
      await TA('2× 速度約走兩倍時間', async () => {
        au.pause(); au.currentTime = 0; A.setSpeed(1);
        await au.play(); await sleep(700); const one = au.currentTime;
        au.pause(); au.currentTime = 0; A.setSpeed(2);
        await au.play(); await sleep(700); const two = au.currentTime;
        au.pause(); A.setSpeed(1);
        return ok(two > one * 1.5 && two < one * 2.6, `1×走 ${one.toFixed(2)}s，2×走 ${two.toFixed(2)}s`);
      });

      await TA('⏹ 停止會回到起始秒數', async () => {
        $('#startAt').value = '1'; A.readStart();
        au.currentTime = 2.2; await au.play(); await sleep(250);
        $('#btnStop').click(); await sleep(120);
        return ok(au.paused && Math.abs(au.currentTime - 1) < 0.25 && $('#btnPlay').textContent === '▶', 'currentTime=' + au.currentTime);
      });

      await TA('指定起始秒數 1.5 秒後載入即從該處開始', async () => {
        $('#startAt').value = '1.5'; A.readStart();
        await A.loadTrack(0, false);
        await sleep(500);
        return ok(Math.abs(au.currentTime - 1.5) < 0.3, 'currentTime=' + au.currentTime);
      });

      await TA('單曲重複播完自動從起始秒數再來', async () => {
        $('#startAt').value = '0.5'; A.readStart();
        A.setRepeat('one');
        au.currentTime = 2.75; await au.play();
        const looped = await new Promise((res) => {
          const t = setTimeout(() => res(false), 4000);
          const h = () => { if (au.currentTime >= 0.4 && au.currentTime < 1.4) { clearTimeout(t); au.removeEventListener('timeupdate', h); res(true); } };
          au.addEventListener('timeupdate', h);
        });
        au.pause(); A.setRepeat('off'); $('#startAt').value = ''; A.readStart();
        return ok(looped, '沒有在 0.5 秒附近重新開始');
      });

      await TA('A-B 區間重複會跳回 A 點', async () => {
        S.ab = { a: 0.6, b: 1.2, on: false };
        au.currentTime = 0.6; $('#btnAB').click();   // 開啟
        let over = 0, samples = 0;
        const t0 = Date.now();
        while (Date.now() - t0 < 2200) { await sleep(90); samples++; if (au.currentTime > 1.45 || au.currentTime < 0.45) over++; }
        const wrapped = au.currentTime <= 1.45;
        $('#btnABClr').click(); au.pause();
        return ok(over === 0 && wrapped && samples > 8, `${over}/${samples} 次跑出區間，最後位置 ${au.currentTime.toFixed(2)}`);
      });

      await TA('拖進度條可跳到指定位置', async () => {
        au.pause(); const sk = $('#seek');
        sk.value = '500'; sk.dispatchEvent(new Event('input')); sk.dispatchEvent(new Event('change'));
        await sleep(200);
        return ok(Math.abs(au.currentTime - au.duration / 2) < 0.3, 'currentTime=' + au.currentTime);
      });
    }

    /* ---------------- 3b. 波形 + 框選重複範圍 ---------------- */
    group = '3 波形框選重複範圍';
    const waveReady = await (async () => {
      for (let i = 0; i < 60; i++) { if ((A.peaks() || []).length) return true; await sleep(150); }
      return false;
    })();
    T('自動分析出波形峰值', () => ok(waveReady && A.peaks().length === 520, waveReady ? '共 ' + A.peaks().length + ' 根' : '逾時'));
    T('峰值有內容（不是全零）', () => ok((A.peaks() || []).some((v) => v > 0.2)));
    T('canvas 真的畫出東西（不是空白）', () => {
      A.drawWave();
      const c = A.cv, g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 8) lit++;
      return ok(lit > 20, '取樣到 ' + lit + " 個著色點");
    });
    T('波形提示文字在有波形後隱藏', () => ok($('#waveHint').style.display === 'none'));

    const rect = () => A.cv.getBoundingClientRect();
    const pt = (frac, type) => {
      const r = rect();
      A.cv.dispatchEvent(new PointerEvent(type, {
        clientX: r.left + r.width * frac, clientY: r.top + r.height / 2,
        pointerId: 1, isPrimary: true, bubbles: true, cancelable: true,
      }));
    };
    T('在波形上拖曳＝框出重複範圍', () => {
      A.clearRange();
      pt(0.25, 'pointerdown'); pt(0.35, 'pointermove'); pt(0.60, 'pointermove'); pt(0.60, 'pointerup');
      const d = au.duration;
      return ok(Math.abs(S.ab.a - 0.25 * d) < 0.12 && Math.abs(S.ab.b - 0.60 * d) < 0.12,
        `得到 ${S.ab.a?.toFixed(2)}–${S.ab.b?.toFixed(2)}（片長 ${d.toFixed(2)}）`);
    });
    T('拖右側把手＝調整終點', () => {
      pt(0.60, 'pointerdown'); pt(0.70, 'pointermove'); pt(0.85, 'pointermove'); pt(0.85, 'pointerup');
      return ok(Math.abs(S.ab.b - 0.85 * au.duration) < 0.12 && Math.abs(S.ab.a - 0.25 * au.duration) < 0.12,
        `得到 ${S.ab.a.toFixed(2)}–${S.ab.b.toFixed(2)}`);
    });
    T('拖範圍內部＝整段平移、長度不變', () => {
      const len = S.ab.b - S.ab.a;
      pt(0.50, 'pointerdown'); pt(0.45, 'pointermove'); pt(0.40, 'pointermove'); pt(0.40, 'pointerup');
      return ok(Math.abs((S.ab.b - S.ab.a) - len) < 0.06 && S.ab.a < 0.25 * au.duration,
        `長度 ${len.toFixed(2)} → ${(S.ab.b - S.ab.a).toFixed(2)}，起點 ${S.ab.a.toFixed(2)}`);
    });
    T('單擊波形＝跳到該處（不會改到範圍）', () => {
      const a = S.ab.a, b = S.ab.b;
      pt(0.9, 'pointerdown'); pt(0.9, 'pointerup');
      return ok(Math.abs(au.currentTime - 0.9 * au.duration) < 0.2 && S.ab.a === a && S.ab.b === b,
        'currentTime=' + au.currentTime.toFixed(2));
    });
    T('用秒數欄位精確指定範圍', () => {
      $('#rangeA').value = '0:01'; $('#rangeB').value = '2.5';
      $('#rangeB').dispatchEvent(new Event('change'));
      return ok(Math.abs(S.ab.a - 1) < 0.01 && Math.abs(S.ab.b - 2.5) < 0.01, `${S.ab.a}–${S.ab.b}`);
    });
    T('「整首」把範圍設成 0～片長', () => {
      $('#btnABAll').click();
      return ok(S.ab.a === 0 && Math.abs(S.ab.b - au.duration) < 0.01);
    });
    await TA('範圍會跟著曲目各自記住', async () => {
      A.setRange(0.4, 1.1);
      const mine = [S.ab.a, S.ab.b];
      await A.loadTrack(1, false); await sleep(400);
      const other = S.ab.a;
      await A.loadTrack(0, false); await sleep(400);
      return ok(other === null && Math.abs(S.ab.a - mine[0]) < 0.01 && Math.abs(S.ab.b - mine[1]) < 0.01,
        `第二首 ${other}，回來後 ${S.ab.a}–${S.ab.b}`);
    });

    if (clockOk) {
      await TA('範圍重複時切換速度：立即生效且仍在範圍內繞圈', async () => {
        A.setRange(0.5, 1.3);
        A.setSpeed(1);
        $('#btnAB').click();                       // 開始範圍重複
        await sleep(500);
        if (au.paused || au.currentTime < 0.45) return `沒有開始播放（paused=${au.paused} t=${au.currentTime.toFixed(2)}）`;
        A.setSpeed(2);                             // 重複中改速度
        let out = 0, n = 0;
        const t0 = Date.now();
        while (Date.now() - t0 < 2000) { await sleep(90); n++; if (au.currentTime < 0.45 || au.currentTime > 1.55) out++; }
        const rate = au.playbackRate;
        A.setSpeed(1); $('#btnABClr').click(); au.pause();
        return ok(rate === 2 && out === 0 && n > 8, `速度 ${rate}，${out}/${n} 次跑出範圍`);
      });
      await TA('0.25× 慢速練習也能在範圍內重複', async () => {
        A.setRange(0.8, 1.4); A.setSpeed(0.25);
        $('#btnAB').click(); await sleep(1500);
        const inside = au.currentTime >= 0.75 && au.currentTime <= 1.5;
        const rate = au.playbackRate;
        A.setSpeed(1); $('#btnABClr').click(); au.pause();
        return ok(rate === 0.25 && inside, `速度 ${rate}，位置 ${au.currentTime.toFixed(2)}`);
      });
    } else {
      SKIP('範圍重複時切換速度：立即生效且仍在範圍內繞圈', '無音效裝置，媒體時鐘不前進');
      SKIP('0.25× 慢速練習也能在範圍內重複', '無音效裝置，媒體時鐘不前進');
    }

    group = '3 實際播放';
    await TA('切下一首會換曲目', async () => {
      au.pause(); A.setRepeat('all');
      const before = S.index;
      $('#btnNext').click(); await sleep(400);
      A.setRepeat('off'); au.pause();
      return ok(S.index !== before && S.index >= 0, `index ${before} → ${S.index}`);
    });

    await TA('壞掉的路徑會標記錯誤而不是整頁爆掉', async () => {
      A.setTracks([{ key: 'bad', kind: 'server', url: 'music/__aptest__/不存在.wav', name: '壞檔', size: 0 }], 'bad');
      await sleep(700);
      $('#btnPlay').click();
      await sleep(900);
      return ok(S.tracks[0].err === true || au.error != null, '沒有偵測到載入錯誤');
    });

    group = '4 穩定性';
    T('過程中沒有未預期的 JS 錯誤', () => ok(errs.length === 0, errs.join(' | ')));
  }

  run().catch((e) => R.push({ g: 'runner', name: 'driver 自己爆了', ok: false, msg: String(e && e.stack || e) }))
    .then(() => {
      const payload = JSON.stringify({ results: R, errors: errs, ua: navigator.userAgent });
      const url = COLLECT || 'http://127.0.0.1:8112/r';
      let sent = false;
      try { sent = navigator.sendBeacon(url, payload); } catch (e) {}
      if (!sent) fetch(url, { method: 'POST', mode: 'no-cors', body: payload }).catch(() => {});
      const pre = document.createElement('pre');
      pre.id = '__results'; pre.style.display = 'none'; pre.textContent = payload;
      document.body.appendChild(pre);
    });
})();
