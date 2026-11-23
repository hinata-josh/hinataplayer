# 🎵 Hinata Player — Google Drive 音檔播放器

登入 Google Drive、挑一個資料夾掃出所有可播放音檔、建成播放清單，然後用
**0.25×～2× 變速**、**重複播放**、**指定起始秒數**、**框選重複範圍**來練唱／聽寫／反覆聽某一段。

單檔前端（`hinataplayer.html`），本機雙擊即用，也可以直接丟上 GitHub Pages。

---

## 快速開始（本機）

| 系統 | 雙擊這個 |
|---|---|
| Windows | **`開啟播放器.bat`** |
| macOS | **`開啟播放器.command`** |

都會開 `http://localhost:8110/`。macOS 第一次雙擊若沒反應，先在終端機跑一次
`chmod +x "開啟播放器.command"`，或用「**右鍵 → 打開**」繞過 Gatekeeper。
需要 Node.js（`brew install node`，或 [nodejs.org](https://nodejs.org)）；有裝 bun 也可以。

三種音檔來源，可以混著用：

| 分頁 | 來源 | 需要什麼 |
|---|---|---|
| ☁️ **Drive** | 你的 Google Drive 資料夾 | 一次性設定 OAuth 用戶端 ID（見下） |
| 💻 **本機** | 選資料夾／選檔／直接拖進來 | 不需要任何設定 |
| 🗂️ **音樂庫** | 本工具底下的 `music\` | 由 `.bat` 啟動的本機伺服器 |

> Google 只允許 **https** 或 **localhost** 登入，所以 Drive 一定要走 `.bat` 開的 `localhost:8110`
> （或部署到 GitHub Pages），直接雙擊 html 用 `file://` 開是**沒辦法登入**的。

---

## 播放控制

- **速度**：`0.25× / 0.5× / 1× / 1.5× / 2×` 五顆鍵，旁邊還有滑桿可微調（0.25～2，每 0.05 一格）。
  預設**保留音高**，慢速播放不會變成低音怪聲——練唱、抓歌詞很有用。
  **範圍重複時改速度會立刻生效**，不用重新開始。
- **重複播放**：`關閉 / 🔂 單曲 / 🔁 全部`，另有 `🔀 隨機`。
- **起始秒數**：填 `12` 或 `1:23`，按「↩️ 從這裡播」。勾「每首記住」的話，每首歌各自記自己的起點；
  **⏹ 停止**就是回到這個起點（不是回 0:00）。
- **重複範圍（A-B）**：在**波形上拖曳**就能框出要重複的那一段——
  - 拖**空白處** = 框新範圍；拖**兩側把手** = 調邊界；拖**範圍內** = 整段平移；**單擊** = 跳到該處
  - 也可以用「起 / 迄」兩個欄位精確填秒數（支援 `1:23`），或按「整首」
  - 按 **🔁 範圍重複** 開始繞圈，範圍同樣**每首歌各自記住**
- 進度條可拖（伺服器支援 HTTP Range），音量、快速鍵見程式裡的「⌨️ 快速鍵」。

### 快速鍵
`空白` 播放/暫停　`S` 停止　`N`/`P` 下/上一首　`←`/`→` ±5 秒（加 `Shift` 為 1 秒）
`↑`/`↓` 音量　`[`/`]` 上下一檔速度　`1`~`5` 直接選 0.25/0.5/1/1.5/2×
`A`/`B` 範圍起訖＝現在　`L` 範圍重複開關　`R` 切換重複模式　`0` 回起始秒數並播放

---

## 自選播放清單

想自己挑歌，而不是整個資料夾照掃：

1. 按 **➕ 新自選清單**，給它一個名字
2. 到 ☁️ Drive 分頁**勾選**想要的曲目 → **➕ 加入勾選**
   （勾選會**跨資料夾累積**，可以逛好幾個資料夾再一次加入）
3. 也可以按 **➕ 整個資料夾** 附加整夾，或在 🗂️ 音樂庫每組右邊按 **➕**，
   本機分頁勾「加入現有清單」就是附加而非取代 → **三種來源可以混在同一份清單裡**
4. 曲目可**拖曳換順序**、`✕` 移除、`🔤 排序`、`🔃 反轉`

清單一旦有名字，之後的每次改動（加歌、刪歌、換順序、改起始秒數與重複範圍）都會**自動存回**瀏覽器。
另有 `✏️` 改名、`🗑️` 刪除、`📤` 匯出 JSON、`📥` 匯入 JSON（匯入時可選「加入」或「取代」，重複曲目會自動去重）。

> 本機檔案因為瀏覽器安全限制沒辦法存進清單（下次開網頁瀏覽器不能自己去讀你的硬碟），
> 存清單時會提示略過幾首。Drive 與音樂庫的曲目都能正常保存與還原。

---

## 取得 Google OAuth 用戶端 ID（一次性）

瀏覽器端不能用桌面型憑證，要自己開一個「網頁應用程式」型的：

1. [Google Cloud Console → 憑證](https://console.cloud.google.com/apis/credentials)
2. 啟用 **Google Drive API**
3. 建立憑證 → OAuth 用戶端 ID → 類型 **網頁應用程式**
4. **已授權的 JavaScript 來源**加入（要用哪個就加哪個）：
   - `http://localhost:8110` ← 本機用 `.bat` 開
   - `https://<你的帳號>.github.io` ← 部署到 GitHub Pages（只填 origin，不含路徑）
5. 把 `xxxx.apps.googleusercontent.com` 貼進 App 的 **⚙️ 設定**
6. 同意畫面若是「測試中」，把自己的 Google 帳號加進**測試使用者**

用的是 **`drive.readonly`（唯讀）** 權限：要讀「你早就存在 Drive 裡的」音檔，只能用這個範圍
（`drive.file` 只看得到 App 自己建的檔）。播放時把音檔臨時抓進瀏覽器記憶體，**不會寫回 Drive**，
快取上限可在設定調整（預設 400MB，超過就丟最舊的）。

---

## 部署到 GitHub Pages

純前端，不需要任何後端：

1. 把這個資料夾推上 GitHub（`music/` 已被 `.gitignore` 排除，音檔不會上傳）
   需要的檔案只有：`hinataplayer.html`、`index.html`、`.nojekyll`
2. repo **Settings → Pages** → Source 選 `Deploy from a branch`，branch 選 `main` / 根目錄
3. 開 `https://<帳號>.github.io/<repo>/`（`index.html` 會自動轉到 `hinataplayer.html`）
4. 把 `https://<帳號>.github.io` 加進上面第 4 步的 JavaScript 來源

線上版可用 **☁️ Drive**（HTTPS 才能登入 Google）與 **💻 本機檔案**；
🗂️ 音樂庫是本機伺服器的功能，線上版會自動顯示提示不會報錯。手機用線上版即可（iOS Safari 也可以）。

## MacBook / 跨平台

播放器本體是純前端，**Mac 完全可以用**，三種方式挑一種：

1. **本機跑**：雙擊 `開啟播放器.command`（需要 Node.js，見上面的快速開始）
2. **完全不裝東西**：用 GitHub Pages 版，Mac 開瀏覽器就能用 Drive 與本機檔案
3. 只想聽本機檔：也可以直接雙擊 `hinataplayer.html`，但 `file://` **沒辦法登入 Google**、
   也沒有音樂庫，只能用 💻 本機分頁

Mac 上建議用 **Chrome**。Safari 可以跑（已針對舊版 Safari 加上 `webkitAudioContext`、
`FileReader`、`<dialog>` 的回退），但要注意：

- Safari 對 **ogg / opus** 支援不完整，這類檔在 Safari 上可能播不出來（mp3 / wav / m4a / aac / flac 沒問題）
- iOS Safari 沒有「選資料夾」，本機分頁只能一次選多個檔
- 音量在 iOS 由實體按鍵控制，網頁的音量滑桿不生效

macOS 對應的啟動器：`開啟播放器.command`／`手機連線.command`／`測試.command`
（三個都是 LF + shebang，`.gitattributes` 已鎖住換行，測試也會檢查）。
`server.js` 是純 node，沒有任何 Windows 專屬路徑；測試腳本找 Chrome 會依平台自動判斷，
放在別的地方也可以用 `AP_CHROME=/路徑/到/chrome` 指定。

## 手機（同一個 WiFi，不上網）

雙擊 **`手機連線.bat`**（macOS：`手機連線.command`），手機開畫面上顯示的區網網址。
但區網是 `http://192.168.x.x`，**Google 不允許在這種來源登入**，
所以手機走區網只能用 🗂️ 音樂庫／💻 本機；要在手機上放 Drive 音檔請用 GitHub Pages 版。

---

## 測試

雙擊 **`測試.bat`**（macOS：`測試.command`；或直接 `node test/verify.js`）。約 30 秒，**真的**用無頭 Chrome 跑整頁：

- node 端直接打 `server.js`：Range `206`／`bytes=N-`／`bytes=-N`／`416`、目錄穿越防護、MIME
- 頁內 151 項斷言：時間解析、音檔判斷、Drive 資料夾 ID 解析、曲序與重複邏輯、LRU 快取、
  自選清單（去重／自動存／改名／匯入匯出）、波形峰值與 canvas 真的有畫、
  拖曳框選／把手／平移／單擊跳播
- 並且**真的播一段 3 秒測試音**：驗證 2× 真的走兩倍、⏹ 回起始秒數、單曲重複、
  範圍重複繞圈、重複中切 0.25×／2× 立即生效
- 跨平台守門：`.bat` 是 CRLF、`.command` 是 LF＋shebang、測試腳本沒有硬綁 `K:\` 路徑、
  頁面帶著 Safari 回退
- ALAC：16/24-bit、單/雙聲道素材逐樣本比對；ALAC m4a 在頁面裡自動轉 WAV 播放；MP3/WAV 轉檔下載（共 174 項）

`node test\shot.js` 可另外輸出一張版面截圖（`test\_shot.png`）。

---

## 轉檔下載（MP3 / WAV）

播放區最下面一列「轉檔下載」：把**目前這首**轉成 MP3（128～320 kbps）或無損 WAV 直接下載。
勾「只輸出重複範圍」就只輸出 A～B 那一段（檔名會帶 `_1m23s-2m05s`）。
全部在瀏覽器裡轉，不會上傳到任何地方；MP3 編碼器是內附的 `vendor/lame.min.js`（lamejs 1.2.1），
內網、離線、GitHub Pages 都能用。3 分鐘的歌轉 MP3 約十幾秒，旁邊會顯示進度。

## 支援的格式

`mp3 / wav / m4a / aac / ogg / opus / flac / weba / webm / mp4` 走瀏覽器原生解碼，都沒問題。

**iPhone「語音備忘錄」的 .m4a 是 ALAC（Apple 無損）**——Chrome / Firefox 播不動。播放器偵測到
`<audio>` 播不了 m4a 時，會在前端自己把 ALAC 解成 WAV 再播（3 分鐘約 1 秒），波形、變速、
重複範圍、轉檔下載都照常可用。解碼器照 Apple 開源參考實作移植，與 ffmpeg 解碼結果逐樣本相同。
`wma / aiff / mid / amr` 會列出但標 ⚠️——Chrome 多半播不動，這是瀏覽器的限制不是工具壞了。

## 檔案

| 檔案 | 作用 |
|---|---|
| `hinataplayer.html` | 播放器本體（單檔，含所有 UI 與邏輯） |
| `index.html` | GitHub Pages 入口，轉址到本體 |
| `server.js` | 本機伺服器：靜態檔＋`/api/local` 音樂庫＋HTTP Range |
| `開啟播放器.bat` / `.command` | 雙擊啟動（localhost:8110，Drive 登入要走這個）Windows／macOS |
| `手機連線.bat` / `.command` | 區網模式（手機同 WiFi 連） |
| `測試.bat` / `.command` | 無頭 Chrome 實跑驗證 |
| `test\verify.js` `test\driver.js` | 驗證腳本（node 端／頁內） |
| `vendor\lame.min.js` | MP3 編碼器（lamejs 1.2.1，離線可用） |
| `test\alac.js` `test\alac-fixture.js` `test\fixtures\*.m4a` | ALAC 解碼／轉檔的 Node 端測試與素材（無損 → 逐樣本比對） |
| `test\chrome.js` | 跨平台找 Chrome（可用 `AP_CHROME` 覆寫） |
| `music\` | 音樂庫目錄（不進 git） |
