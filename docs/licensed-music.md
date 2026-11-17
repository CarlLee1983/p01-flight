# 第一關錄製配樂

2026-11-17：Carl 實玩認為程序配樂品質不足。這次改用完整錄製曲目，不再將非零 PCM 或測試綠勾當成好聽；目前沒有完成主觀人工聆聽。沒有變更遊戲難度、敵機、存檔 schema、repo 可見性或根目錄授權。

## 選曲與授權

- 第一關：Intergalactic Odyssey，Patrick de Arteaga，88 秒。作者描述為未來感搖滾、適合街機戰鬥；依其描述選為候選，不宣稱親聽後優於其他曲。
- Boss：Battleship，同作者，89.142857 秒。作者列為戰鬥／緊張場景。
- 原曲與試聽：[作者 Arcade Music](https://patrickdearteaga.com/en/arcade-music/)。直接來源：<https://patrickdearteaga.com/audio/Intergalactic%20Odyssey.ogg>、<https://patrickdearteaga.com/audio/Battleship.ogg>。
- 核對日期：2026-11-17。[作者 Free License](https://patrickdearteaga.com/en/licensing/) 與 [FAQ](https://patrickdearteaga.com/en/faq/) 准許遊戲等多媒體專案附署名使用及商業使用；改作須標示，禁止單獨轉售或再授權音樂。頁面稱 Creative Commons attribution，但未給版本，故不擅稱 CC BY 4.0 或 CC0。以作者明列的 Free License 條件記錄。
- 本專案使用署名及來源連結；OGG 保留原檔，另轉 MP3 160kbps 備援，未裁切／變速，遊戲另做增益、轉場與解碼後首尾各 5ms 邊緣淡化。這是授權配樂，不是本遊戲專屬原創，不因程式日後改授權而改變音檔權利。

原始 OGG SHA256：stage01 `837916f94de81d68872bcc3fe3485b484d7627f2ab75d6ab40d1eaecc9eb5be6`；boss `1b71e0faff034a266ff7147ce6f5c0d69a1601a3c7d2c88d102d594fbf44fa09`。來源下載完成且 ffmpeg 可解碼，兩首原始峰值約 0 dBFS；stage01 原始首尾單聲道差約 0.159，因此解碼後作 5ms 邊緣淡化避免直接振幅跳變，不稱音樂句法完全無縫。遊戲不以滿音量直出，保留音效空間；數值不等於聽感。

## 播放與限制

同源靜態音檔，不呼叫外部音樂API。AudioContext 維持使用者手勢解鎖；一首關卡曲與一首 Boss 曲快取，轉場暫時最多兩音源；停止／暫停／隱藏／重開處理音源清理。聲音播放時間不依賴遊戲幀率。OGG 解碼失敗才嘗試 MP3；音樂載入失敗不阻止遊戲與原有音效。

`audio-preview.html` 提供手動試聽，沒有 autoplay。遊戲音量／靜音沿用本機設定。OGG 播放循環接縫尚未人工聽驗，MP3 備援可能有編碼器延遲，不宣稱所有裝置完全無縫。音檔約 6.1MiB（含雙格式）；只載入能用的格式，不同時下載兩套。

Web Audio 技術來源：[decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)、[Codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs)。解碼與 AudioContext running 不代表使用者喇叭、路由或系統靜音已驗證。真機 iOS Safari、耳機/喇叭混音、實際主觀聆聽及 Carl 遊戲感驗收仍待。

## 本機驗證界線

本輪測試伺服器可啟動，但 Playwright 專用瀏覽器未安裝；官方安裝器取得空的非ZIP而失敗。既有 /usr/bin/chromium 啟動仍在 process_singleton 的 socket() 回 EPERM，未繞過。實際瀏覽器解碼／控制／畫面交由精確 CI 驗證，不能把本機 mock 當實頁。原有程序樂譜測試顯式使用 legacy 模式保留；另新增預設錄製模式整合與編碼解碼測試，不以老測試數混稱新模式已驗。
