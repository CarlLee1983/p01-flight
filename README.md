# P01 · 雲際航線／赤岩峽谷／極光前哨

原創縱向戰機射擊遊戲，使用 Phaser 4.2.1、TypeScript 與 Vite。純靜態前端，沒有帳號、遊戲後端、API、資料庫或雲端存檔；最高分、分關通關紀錄與音量保存在瀏覽器。玩法類型參考傳統縱向街機射擊，不使用 Raiden Fighters 的素材、音樂、角色或關卡。

Repository 已依擁有者授權公開；私人試玩站仍由專案協調者維護。開發分支與這份交付不會自行合併或部署。

## 本機執行

Node.js 24、npm，使用鎖檔安裝：

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run typecheck
npm test
npm run build
node scripts/serve.mjs
```

正式建置在 `http://127.0.0.1:4173`。若收到已建置 ZIP，解壓後在包含 `dist/` 和 `scripts/` 的目錄執行 `node scripts/serve.mjs`，不必安裝遊戲依賴。

請使用 HTTP 靜態伺服器，不要以 file:// 雙擊 HTML。本版未製作 Service Worker 離線安裝；首次開啟需要下載資源。正式更新應保留私人試玩站既有網址與存取限制。

## 關卡與操作

- **Stage 01 雲際航線**：港區、沿岸火力與出港突圍，125 秒 Boss 出場，170 秒上限。
- **Stage 02 赤岩峽谷**：河谷、鋼桁橋、礦區、水壩與開闊蓄水池；145 秒 Boss 出場，190 秒上限。上限不是固定遊玩長度，提前擊破 Boss 即通關。
- **Stage 03 極光前哨**：雪原鐵道、機場、雷達與冰灣；155秒極地雷眼出場，205秒上限。
- 依序通關解鎖下一關，結算可直接銜接或從標題頁選關；三關紀錄分開保存，舊v1存檔不需遷移。第二關改獨立鐵閘守衛核心，加入斜切機、轟炸機、飛彈車及防空砲。
- WASD／方向鍵八方向移動；Space／Z 按住連射；C 換散射／貫穿／追蹤；Shift 精準慢移；X 使用炸彈；P 暫停；Enter 開始或重試。
- 觸控按住畫面拖曳移動並連射，指尖按下不會讓戰機瞬移。側欄提供炸彈、換武器、暫停；旋轉裝置會取消舊手勢，回正後重新按住即可。窄螢幕與橫向暫停選單可捲動，直向較適合縱向關卡。
- 三條生命，受傷有 1.5 秒無敵；生命歸零或超時則失敗。結算可重試／返回標題，離開分頁自動暫停。
- 補給圖示：P 升級、十字修復、S/B/M 切武器並升一級、W 提供 8 秒雙僚機；C 仍可自由換武器，僚機不擋子彈。
- 第二、三關「再飛一次」保留編隊 seed；「重新編隊出擊」換新 seed。`?seed=42` 固定一般新出擊；結果頁重新編隊刻意覆蓋本次 seed，重新載入該網址則回到 42。這不是無敵或跳時間入口。

第二、三關設計與新敵方驗收見 [next-fronts.md](docs/next-fronts.md)。

## 音樂與素材

首次操作解鎖聲音。音樂／音效音量及靜音會保存，暫停與背景分頁停止聲音。使用合法錄製關卡與 Boss 配樂，第二、三關目前共用曲目；射擊、爆炸等音效為原創。播放器／頁尾保留署名與試聽，來源見 [licensed-music.md](docs/licensed-music.md)。

機體、地形、動畫與 Kenney CC0 素材來源見 [素材清單](docs/asset-manifest.md) 和 [原創素材紀錄](docs/original-art-production.md)。第二關六張原創素材的完整內建 image_gen 提示、處理方式與 WebP 雜湊見 [stage02-art-sources.json](docs/stage02-art-sources.json)。地標是場景；真正地炮、補給駁船及敵機仍是獨立遊戲元件。

## 測試與驗收

```sh
npx playwright install --with-deps chromium firefox webkit
npm run typecheck
npm test
npm run build
npm run test:e2e
```

系統 Chromium 可設定 `CHROMIUM_PATH=/usr/bin/chromium`。本機環境若禁止 socket／ptrace，應記錄阻礙並使用可行 CI，不繞過權限限制。

測試使用正常鍵盤與 CDP 觸控，不改血量、跳時間或指定勝利。包含三關完整出擊、實際跨關、正常失敗與重試、手機旋轉／回正、設定與重設、真正關閉重開瀏覽器、舊存檔兼容、音訊解鎖及格式回退。第二關另有正常操控地炮轉向／實彈／受擊／擊破取證，並保存實際敵種照片、事件 JSON 與完整影片。

完整出擊在 Chromium 驗證；Firefox/WebKit 為啟動、輸入或音訊 smoke，不冒稱完整跨瀏覽器通關。

目前測試規模為510 unit與38 E2E；本輪精確CI與實頁驗收尚待結果，見[後續關卡紀錄](docs/next-fronts.md)，不能把新增測試程式當成已通過。PR11是已試玩基底，新PR疊在其分支上。舊版少量測試或先前 CI 不代替本版。手機模擬不等於實體手機手感；音訊解碼通過不等於人工聆聽驗收。遊戲趣味與獨立視覺覆核仍需分開記錄。

全域 batchSize 維持 4096，只對 Image/Text 使用 QuadSingle；第二關素材只在載入時烘焙接縫與段落透明邊，不逐幀重建大圖。效能以真 WebGL 提交與 RAF 間隔觀測，不把 CPU 繪圖命令時間稱作 GPU 時間。詳見 [渲染紀錄](docs/render-batching-performance.md)。

## 存檔與架構

key：`p01-flight:save:v1`。結算只寫一次，設定／重設才更新對應資料。損壞 JSON 或寫入被拒絕不會阻擋遊玩，會顯示提示。紀錄只屬於當前 origin/browser，可能被清除，不能跨裝置同步，也不適合作可信排行榜。

- `src/data/stage.ts`、`stage02.ts`、`stage03.ts`：三關配置與受控隨機波次；補給、休息窗口和 Boss 時點固定。
- `src/game/model.ts`：不依賴 Phaser 的模擬、碰撞、池化與勝敗。
- `src/game/stage-selection.ts`／`stage-catalog.ts`：逐關解鎖、銜接、文案與seed。
- `src/game/canyon-background.ts`：快取地形、地標與 Boss 蓄水池。
- `src/storage/save.ts`：版本化存檔及失敗降級。
- `src/main.ts`：Phaser 呈現、輸入、HUD 與 HTML 選單。
- `scripts/serve.mjs`：交付用本機靜態伺服器，不是遊戲後端。

沒有通用 ECS 或自製遊戲引擎。`__P01__()` 為診斷快照，沒有改生命／時間的捷徑。第一關經驗見 [製作手冊](docs/stage01-production-playbook.md)；第二關設計與實際覆核紀錄見 [stage02-canyon.md](docs/stage02-canyon.md)。手冊中早期「不開第二關」是已被最新開發授權取代的歷史範圍，不表示第一關已獲真人最終驗收。
