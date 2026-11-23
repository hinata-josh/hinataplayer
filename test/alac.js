/* ALAC 解碼器的 Node 端測試（不需瀏覽器）：node test\alac.js [某個真實 ALAC .m4a]
   直接從 hinataplayer.html 抽出 AP 純邏輯來跑。
   注意：要用 new Function 跑，不要用 vm 沙箱——沙箱裡每次查 Math.* 都走攔截器，會慢 40 倍。 */
const fs = require('fs');
const path = require('path');
const FX = require('./alac-fixture');

function loadAP() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'hinataplayer.html'), 'utf8');
  const js = html.match(/<script>\s*"use strict";([\s\S]*?)<\/script>/)[1];
  const s = js.indexOf('const AP = {}'), e = js.indexOf('/** 自然排序');
  const AP = new Function('"use strict";\n' + js.slice(s, e) + '\nreturn AP;')();
  AP.SHOW_LOG = false;
  return AP;
}

function run() {   // 回傳 Promise<結果陣列>
  const AP = loadAP(), out = [];
  const T = (name, fn) => { try { const m = fn(); out.push({ name, ok: m === true, msg: m === true ? '' : String(m) }); } catch (e) { out.push({ name, ok: false, msg: 'throw: ' + e.message }); } };

  for (const f of FX.FIXTURES) {
    const file = path.join(FX.DIR, f.file);
    T(`ALAC ${f.bits}-bit ${f.ch === 2 ? '立體聲' : '單聲道'}：無損還原逐樣本相同`, () => {
      const u8 = new Uint8Array(fs.readFileSync(file));
      const r = AP.alacDecode(u8), exp = FX.expect16(f.ch, f.bits);
      if (r.channels !== f.ch || r.sampleRate !== FX.RATE) return `格式不符 ${r.channels}ch ${r.sampleRate}Hz`;
      if (r.pcm.length !== exp.length) return `長度 ${r.pcm.length}，期望 ${exp.length}`;
      for (let i = 0; i < exp.length; i++) if (r.pcm[i] !== exp[i]) return `第 ${i} 個樣本 ${r.pcm[i]}，期望 ${exp[i]}`;
      return true;
    });
  }
  T('ALAC → WAV 標頭正確（RIFF/WAVE、聲道、取樣率、資料長度）', () => {
    const wav = AP.alacToWav(new Uint8Array(fs.readFileSync(path.join(FX.DIR, FX.FIXTURES[0].file))));
    const dv = new DataView(wav.buffer);
    const s = (p) => String.fromCharCode(...wav.subarray(p, p + 4));
    if (s(0) !== 'RIFF' || s(8) !== 'WAVE' || s(36) !== 'data') return '標頭字串錯';
    if (dv.getUint16(22, true) !== 2 || dv.getUint32(24, true) !== FX.RATE) return '聲道/取樣率錯';
    return dv.getUint32(40, true) === FX.N * 4 || '資料長度 ' + dv.getUint32(40, true);
  });
  T('isAlac：WAV、亂碼不會被誤判成 ALAC', () => {
    const wav = AP.pcmToWav(new Int16Array(100), 1, 8000);
    return (!AP.isAlac(wav) && !AP.isAlac(new Uint8Array(64))) || '誤判';
  });
  T('isAlac：ALAC 素材判斷為 true', () => AP.isAlac(new Uint8Array(fs.readFileSync(path.join(FX.DIR, FX.FIXTURES[1].file)))) || '沒認出來');
  T('截斷的 ALAC 檔丟出可讀的錯誤而不是當掉', () => {
    const u8 = new Uint8Array(fs.readFileSync(path.join(FX.DIR, FX.FIXTURES[0].file)));
    // moov 在檔尾 → 砍掉 mdat 中段：offset 仍指向檔尾外
    const cut = new Uint8Array(u8.length - 4000); cut.set(u8.subarray(0, 200)); cut.set(u8.subarray(4200), 200);
    try { AP.alacDecode(cut); return '竟然沒報錯'; } catch (e) { return /M4A|ALAC|不是/.test(e.message) || '錯誤訊息：' + e.message; }
  });

  /* ---- 轉檔下載 ---- */
  const dec = AP.alacDecode(new Uint8Array(fs.readFileSync(path.join(FX.DIR, FX.FIXTURES[0].file))));
  const chans = [new Float32Array(dec.frames), new Float32Array(dec.frames)];
  for (let i = 0; i < dec.frames; i++) { chans[0][i] = dec.pcm[2 * i] / 32768; chans[1][i] = dec.pcm[2 * i + 1] / 32768; }
  T('轉 WAV：浮點 → 16-bit 往返不失真', () => {
    const wav = AP.chansToWav(chans, FX.RATE);
    const back = new Int16Array(wav.buffer.slice(44));
    if (back.length !== dec.pcm.length) return '長度 ' + back.length;
    for (let i = 0; i < back.length; i++) if (Math.abs(back[i] - dec.pcm[i]) > 1) return `第 ${i} 個 ${back[i]} vs ${dec.pcm[i]}`;
    return true;
  });
  T('只輸出範圍：sliceChans 切出正確長度、越界會夾住', () => {
    const s = AP.sliceChans(chans, FX.RATE, { a: 0.1, b: 0.2 });
    const s2 = AP.sliceChans(chans, FX.RATE, { a: 0.25, b: 99 });
    return (s[0].length === 4410 && s[1].length === 4410 && s2[0].length === dec.frames - Math.floor(0.25 * FX.RATE)) || `${s[0].length} / ${s2[0].length}`;
  });
  T('下載檔名：去副檔名、加範圍標記、濾掉非法字元', () => {
    const a = AP.dlName('又是美好的一天-第三部.m4a', 'mp3', null);
    const b = AP.dlName('a:b.m4a', 'wav', { a: 83.4, b: 125 });
    return (a === '又是美好的一天-第三部.mp3' && b === 'a_b_1m23s-2m05s.wav') || a + ' | ' + b;
  });
  const lamePath = path.join(__dirname, '..', 'vendor', 'lame.min.js');
  const lame = new Function(fs.readFileSync(lamePath, 'utf8') + '\nreturn lamejs;')();
  out.push(null);                                                     // 佔位：MP3 測試是 async，下面補上
  const mp3Test = (async () => {
    const name = '轉 MP3：產出合法 MP3（幀同步碼、片長正確）';
    try {
      const parts = await AP.encodeMp3(lame, chans, FX.RATE, 192);
      const mp3 = Buffer.concat(parts.map((p) => Buffer.from(p)));
      if (!(mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0)) return { name, ok: false, msg: '開頭不是 MP3 幀同步碼' };
      // 數幀：每幀 1152 樣本
      let p = 0, frames = 0;
      const br = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], sr = [44100, 48000, 32000];
      while (p + 4 <= mp3.length && mp3[p] === 0xff && (mp3[p + 1] & 0xe0) === 0xe0) {
        const len = Math.floor(144000 * br[mp3[p + 2] >> 4] / sr[(mp3[p + 2] >> 2) & 3]) + ((mp3[p + 2] >> 1) & 1);
        if (!len) break; p += len; frames++;
      }
      const sec = frames * 1152 / FX.RATE, want = FX.N / FX.RATE;
      if (p !== mp3.length) return { name, ok: false, msg: `幀解析停在 ${p}/${mp3.length}` };
      if (Math.abs(sec - want) > 0.08) return { name, ok: false, msg: `片長 ${sec.toFixed(3)}，期望 ≈${want.toFixed(3)}` };
      let probe = '';
      try {
        const ffprobe = require('child_process').execFileSync;
        const tmp = path.join(require('os').tmpdir(), 'ap-test.mp3'); fs.writeFileSync(tmp, mp3);
        const exe = process.env.FFPROBE || path.join(__dirname, '..', '..', 'tools', 'ffmpeg', 'bin', 'ffprobe.exe');
        if (fs.existsSync(exe)) probe = '｜ffprobe：' + ffprobe(exe, ['-v', 'error', '-show_entries', 'stream=codec_name,channels,bit_rate', '-of', 'csv=p=0', tmp]).toString().trim();
      } catch (e) { probe = '｜ffprobe 讀不了：' + e.message; return { name, ok: false, msg: probe }; }
      return { name, ok: true, msg: `${frames} 幀 ${mp3.length} bytes${probe}` };
    } catch (e) { return { name, ok: false, msg: 'throw: ' + e.message }; }
  })();

  const real = process.argv[2];
  if (real && require.main === module) {
    T('真實檔案解碼：' + path.basename(real), () => {
      const t0 = Date.now(); const r = AP.alacDecode(new Uint8Array(fs.readFileSync(real)));
      console.log(`    ${r.channels}ch ${r.sampleRate}Hz ${(r.frames / r.sampleRate).toFixed(2)} 秒，耗時 ${Date.now() - t0} ms`);
      return r.frames > 0;
    });
  }
  return mp3Test.then((r) => { out[out.indexOf(null)] = r; return out; });
}

module.exports = { run };

if (require.main === module) (async () => {
  const res = await run(); let bad = 0;
  for (const r of res) { console.log((r.ok ? '\x1b[32m✔' : '\x1b[31m✘') + '\x1b[0m ' + r.name + (r.msg ? '  — ' + r.msg : '')); if (!r.ok) bad++; }
  console.log(bad ? `\x1b[31m${bad} 項失敗\x1b[0m` : `\x1b[32m全部 ${res.length} 項通過\x1b[0m`);
  process.exit(bad ? 1 : 0);
})();
