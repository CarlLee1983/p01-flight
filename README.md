# P01 · 雲際航線

原創縱向戰機射擊技術雛型。本輪範圍：限時 75 秒的 Stage 01，含敵彈、不同敵機行為、道具與關底頭目；採 Kenney CC0 與原創程序效果，不含 Raiden Fighters 的任何素材、音樂、角色或關卡。純靜態前端，無帳號、API、DB、追蹤或雲端存檔。部署由專案協調者維護原有私人試玩站，repo 維持 private。

## 執行

Node.js 24（開發驗證 24.22.1）、npm。

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run typecheck
npm test
npm run build
node scripts/serve.mjs
```

正式建置以 `http://127.0.0.1:4173` 開啟。不要用 file:// 雙擊 HTML：ES modules 與 localStorage 的 file origin 不具可攜保證。純靜態不表示首次開啟不需下載資源；本版未做 Service Worker 離線安裝。可將 dist/ 放任意靜態伺服器，更新時須保留既有試玩站的存取限制與網址。

## 操作與完成條件

- WASD／方向鍵：八方向移動，斜向正規化，不能出界。
- Space／Z：按住連射；Enter：開始或重試；P：暫停。
- 擊落敵機得分；躲避機身與粉紅敵彈。受傷扣一生命並獲得 1.5 秒無敵。
- 三條生命；75 秒內擊敗關底頭目才通關，生命歸零或頭目未在期限內擊敗則失敗。青色十字補血，金色道具提供限時雙射。
- 結算可重試或返回標題，離開分頁自動暫停。
- 桌機鍵盤優先；手機畫面縮放不是手機操控支援。
- 音量偏好可保存，但目前尚未加入音樂／音效，UI 明示此限制。

## 瀏覽器驗收

```sh
npx playwright install --with-deps chromium firefox
npm run build
npm run test:e2e
```

使用系統 Chromium 時可設定 `CHROMIUM_PATH=/usr/bin/chromium`。Playwright 會以固定 localhost origin 啟動靜態伺服器。測試實際按鍵與完整關卡，不藉由修改遊戲時間／生命偷過關。包含自然死亡、暫停、10 次重新開始、重新整理、真正關閉／重開專用 Chromium profile、Firefox smoke、損壞存檔。

目前測試狀態及限制請讀 [docs/verification.md](docs/verification.md)，不可將編譯成功視為已可玩。

## 儲存

key `p01-flight:save:v1`。只在結算／設定／重設時寫入；每場只有一次結算。最高分、通關旗標、通關次數、音量偏好經 schema/version 檢查；JSON 壞掉或儲存拒絕不阻擋遊玩並警示。資料只屬於當前 origin/browser，可能被清除、無法跨裝置同步、可被竄改，不適用可信排行榜。

## 結構

- `src/data/stage.ts`：Stage 01 時長、波次、敵機參數。新增 Stage 02 只需新配置與選關設計，不需改玩家基礎邏輯。
- `src/game/model.ts`：純 TypeScript 模擬、碰撞規則、池化、勝敗；與 Phaser 無依賴，方便單元測試。
- `src/storage/save.ts`：版本化存檔與失敗降級。
- `src/main.ts`：Phaser scene 渲染與輸入、HTML 操作面板、一次性結算。
- `scripts/serve.mjs`：僅供本機靜態交付，不是遊戲後端。

Phaser 負責 Canvas/WebGL 呈現、生命週期及鍵盤；小型幾何碰撞由可測試 model 處理，未引入 Arcade Physics/ECS/通用引擎。渲染和遊戲規則分離。窗口 `__P01__()` 是只讀診斷快照，供 E2E 驗證，沒有修改生命／時間捷徑。

## 範圍與來源

本輪使用者已授權完善第一關：敵彈、不同敵機行為、道具、關底頭目。沒有追加關卡、觸控、音效或改動隱私。美術來源與授權見 [素材清單](docs/asset-manifest.md)。頭目重用同一 CC0 敵機 PNG，以大小和配色區別；敵彈、道具及命中動畫為原創程式圖形。

存檔 schema/key 保持 v1；舊版已通關紀錄保留，不因新的頭目條件重設紀錄。既有高分仍保留，但不同玩法版本的分數不作公平排名。
