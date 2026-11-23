/* ALAC 測試素材：可重現的 PCM 產生器 + （有 ffmpeg 時）重建 test/fixtures/*.m4a
   ALAC 是無損格式 → 解碼結果必須和這裡產生的 PCM「逐樣本完全相同」，不用另存參考檔。

   用法：node test\alac-fixture.js <ffmpeg.exe>    重新產生 fixtures（平常不用跑，fixtures 已附在 repo）
   訊號設計（每一段都在戳解碼器的不同分支）：
     - 正弦波、左右聲道不同        → 一般預測 + 聲道矩陣 (mixRes)
     - 中間一段完全靜音            → 「連續 0」模式（漏寫 mb=0 就會在這裡變雜訊）
     - 最後一幀不足 4096 且是白雜訊 → partial frame + 未壓縮 (escape) 幀 */
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const N = 4096 * 3 + 1000;                    // 3 個整幀 + 1 個不完整幀

const FIXTURES = [
  { file: 'alac-s16-stereo.m4a', ch: 2, bits: 16 },
  { file: 'alac-s16-mono.m4a', ch: 1, bits: 16 },
  { file: 'alac-s24-stereo.m4a', ch: 2, bits: 24 },
];

/** 回傳 Int32Array（交錯），數值範圍符合 bits */
function gen(ch, bits) {
  const out = new Int32Array(N * ch);
  const amp = bits === 24 ? 3000000 : 12000;
  const full = (1 << (bits - 1)) - 1;
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < N; i++) {
    let l, r;
    if (i >= 2000 && i < 6000) { l = r = 0; }                               // 靜音
    else if (i >= 4096 * 3) { l = Math.round((rnd() * 2 - 1) * full); r = Math.round((rnd() * 2 - 1) * full); }   // 白雜訊
    else {
      l = Math.round(Math.sin(2 * Math.PI * 440 * i / RATE) * amp);
      r = Math.round(l * 0.6 + Math.sin(2 * Math.PI * 660 * i / RATE) * amp * 0.3);
    }
    if (ch === 1) out[i] = l; else { out[2 * i] = l; out[2 * i + 1] = r; }
  }
  return out;
}

/** 解碼器輸出一律是 16-bit：24-bit 素材要右移 8 */
function expect16(ch, bits) {
  const s = gen(ch, bits), o = new Int16Array(s.length), sh = bits - 16;
  for (let i = 0; i < s.length; i++) o[i] = s[i] >> sh;
  return o;
}

module.exports = { RATE, N, FIXTURES, gen, expect16, DIR: path.join(__dirname, 'fixtures') };

if (require.main === module) {
  const { execFileSync } = require('child_process');
  const ff = process.argv[2] || 'ffmpeg';
  fs.mkdirSync(module.exports.DIR, { recursive: true });
  for (const f of FIXTURES) {
    const pcm = gen(f.ch, f.bits);
    const raw = Buffer.alloc(pcm.length * (f.bits === 24 ? 4 : 2));
    for (let i = 0; i < pcm.length; i++) {
      if (f.bits === 24) raw.writeInt32LE(pcm[i] * 256, i * 4); else raw.writeInt16LE(pcm[i], i * 2);
    }
    const tmp = path.join(module.exports.DIR, '_tmp.raw');
    fs.writeFileSync(tmp, raw);
    const out = path.join(module.exports.DIR, f.file);
    execFileSync(ff, ['-v', 'error', '-y', '-f', f.bits === 24 ? 's32le' : 's16le', '-ar', String(RATE), '-ac', String(f.ch), '-i', tmp,
      '-c:a', 'alac', ...(f.bits === 24 ? ['-sample_fmt', 's32p', '-bits_per_raw_sample', '24'] : []), '-f', 'mp4', out]);
    fs.unlinkSync(tmp);
    console.log('產生', f.file, fs.statSync(out).size, 'bytes');
  }
}
