/* 最小 CDP 客戶端：用真正的觸控事件驅動 Chrome（會經過真實命中測試與 touch-action，
   跟頁面內 dispatchEvent 的「合成事件」完全不同，很多手勢 bug 只有這樣才抓得到）。 */
const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
let WebSocket;
for (const p of ["ws", "K:/Html5/josh-video/node_modules/ws", "K:/Html5/remotion-main/node_modules/ws"]) {
  try { WebSocket = require(p); break; } catch (e) {}
}
if (!WebSocket) { console.error("找不到 ws 模組，無法做真實觸控測試"); process.exit(2); }

const CHROME = (() => {
  try { return require("./chrome").findChrome(); } catch (e) {}
  try { return require("K:/Html5/helper/paths").CHROME; } catch (e) {}
  return "C:/Program Files/Google/Chrome/Application/chrome.exe";
})();

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(url, opts) {
  opts = opts || {};
  const port = opts.debugPort || 9333;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "nb-cdp-"));
  const args = [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=" + prof, "--remote-debugging-port=" + port,
    "--window-size=" + (opts.size || "820,1180"), "--touch-events=enabled", url,
  ];
  const proc = spawn(CHROME, args, { stdio: ["ignore", "ignore", "ignore"] });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try {
      const list = await getJSON("http://127.0.0.1:" + port + "/json/list");
      target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    } catch (e) {}
  }
  if (!target) { try { proc.kill(); } catch (e) {} throw new Error("連不上 Chrome 除錯埠"); }

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
  let id = 0;
  const waiting = new Map();
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.id && waiting.has(m.id)) {
      const { res, rej } = waiting.get(m.id); waiting.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    }
  });
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    waiting.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    setTimeout(() => { if (waiting.has(mid)) { waiting.delete(mid); rej(new Error("CDP 逾時: " + method)); } }, 20000);
  });

  await send("Runtime.enable");
  await send("Page.enable");
  if (opts.mobile !== false) {
    const [w, h] = (opts.size || "820,1180").split(",").map(Number);
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  }

  const api = {
    send, ws, proc,
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: "(async()=>{" + expr + "})()", awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error("頁面例外: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
      return r.result.value;
    },
    touch(type, pts) {
      return send("Input.dispatchTouchEvent", {
        type, touchPoints: (pts || []).map((p) => ({ x: p.x, y: p.y, id: p.id == null ? 1 : p.id, radiusX: 12, radiusY: 12, force: 1 })),
      });
    },
    async close() { try { ws.close(); } catch (e) {} try { proc.kill(); } catch (e) {} },
  };
  return api;
}

module.exports = { launch, sleep };
