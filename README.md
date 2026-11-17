# P01 · 雲際航線

原創縱向戰機射擊技術雛型。本輪範圍：限時 170 秒的 Stage 01，含敵彈、不同敵機行為、道具與關底頭目；採原創高解析機體、沿岸場景與 Kenney CC0 子彈／尾焰，不含 Raiden Fighters 的任何素材、音樂、角色或關卡。純靜態前端，無帳號、API、DB、追蹤或雲端存檔。部署由專案協調者維護原有私人試玩站，repo 維持 private。

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
- Space／Z：按住連射；C：循環散射／貫穿光束／追蹤飛彈；Shift：精準慢移；X：衝擊炸彈（每場兩枚）；Enter：開始或重試；P：暫停。
- 擊落敵機得分；躲避機身與粉紅敵彈。受傷扣一生命並獲得 1.5 秒無敵。
- 三條生命；170 秒內擊敗關底頭目才通關，生命歸零或頭目未在期限內擊敗則失敗。青色十字補血，金色能量永久提升本場共用火力級別，改善散射覆蓋、光束貫穿數或飛彈數量／傷害。頭目有三個攻擊階段與預告。
- 結算可重試或返回標題，離開分頁自動暫停。
- 桌機鍵盤優先；手機畫面縮放不是手機操控支援。
- 原創合成節奏與射擊／爆炸／升級／炸彈／勝敗聲。首次開始操作才解鎖音訊；設定音量 0 或按「全部靜音」會保存靜音，暫停與背景分頁停止聲音。

## 瀏覽器驗收

```sh
npx playwright install --with-deps chromium firefox
npm run build
npm run test:e2e
```

使用系統 Chromium 時可設定 `CHROMIUM_PATH=/usr/bin/chromium`。Playwright 會以固定 localhost origin 啟動靜態伺服器。測試實際按鍵與完整關卡，不藉由修改遊戲時間／生命偷過關。包含自然死亡、暫停、10 次重新開始、重新整理、真正關閉／重開專用 Chromium profile、Firefox smoke、損壞存檔。

歷史 G0/G1 阻礙見 [docs/verification.md](docs/verification.md)；最新沿岸街機版見 [docs/arcade-increment.md](docs/arcade-increment.md) 及 PR #2 的精確 CI 證據，不可將歷史未驗項當最新測試結果。

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

本輪使用者已授權完善第一關：敵彈、不同敵機行為、道具、關底頭目。沒有追加關卡、觸控或改動隱私；音效與節奏為本專案原創 Web Audio 合成，無外部音檔。美術來源與授權見 [素材清單](docs/asset-manifest.md)。玩家、偵察機、重裝與頭目使用各自原創生成機體；來源、處理及限制見 [原創素材紀錄](docs/original-art-production.md)。敵彈、道具及命中動畫為原創程式圖形。

存檔 schema/key 保持 v1；舊版已通關紀錄保留，不因新的頭目條件重設紀錄。既有高分仍保留，但不同玩法版本的分數不作公平排名。

## 沿岸街機版驗證

程式 head `5ef010c84180d150e3ee6be658235d0f992684c7` 的 [CI](https://github.com/CarlLee1983/p01-flight/actions/runs/43815661148) 通過35個unit、8個E2E、typecheck及build。實際鍵盤完整通關、自然失敗、三phase、炸彈、10次重試、關閉重開存檔、舊v1讀回與音訊解鎖/靜音均通過。最終截圖已目視。Firefox僅smoke，不是完整Firefox通關。無人工聽感或使用者手感結論，私人正式站登入後舊檔未由此CI驗證。

## 最新製作增量

目前功能與驗證限制以 [mobile-controls.md](docs/mobile-controls.md) 為準；第一關內容見 [stage-one-encounters.md](docs/stage-one-encounters.md)；武器包版見 [weapon-capsules.md](docs/weapon-capsules.md)；捲動與三武器版見 [scrolling-combat.md](docs/scrolling-combat.md)，前版見 [coastal-production.md](docs/coastal-production.md)。上述 PR #2 結果是前版歷史紀錄，不代表本版已通過瀏覽器驗收。

連續地景以 32px/s 向下捲動，海流與雲層使用不同速度；C 三種武器有覆蓋、貫穿和追蹤取捨。PR #4 的 CI artifact 包含動態錄影與連續截圖，不將模型通關或靜態畫面等同玩家手感驗收。

補給：P 升級、十字修復、S/B/M 切對應武器並升一級、W 提供 8 秒雙僚機。C 仍能自由換武器；僚機不擋子彈。新增窄翼攔截機和雙貨艙補給機，原創來源保留於素材紀錄。

觸控：按住畫面拖曳並連射，側欄提供炸彈／換武器／暫停；指尖按下不讓戰機瞬移。手機模擬測試不等於真機手感驗收。

## 第一關完整出擊版

第一關125秒迎接Boss、170秒上限，正常示例約146–154秒通關，不新增第二關。不是延長舊空白：港區壓制、第二段岸防火力、左右護航、短補給、出口突圍是不同作戰段落。`src/data/stage.ts`定義戰鬥配置；`src/data/scenery.ts`定義同步地景區塊。

CI的push與PR事件都須通過；不能只看PR成功忽略同head的push失敗。慢裝置/錄影每幀超50ms原會丟失模擬時間，已在渲染入口以最多250ms、每步不超1/60s的有界追幀處理。E2E以遊戲時鐘及有界實際等待確認進程，敗北/暫停/停滯立即提供診斷，不刪完整觸控與存檔驗收。
