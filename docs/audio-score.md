> 歷史實作紀錄：2026-11-17 正式遊戲改用授權錄製配樂，見 [licensed-music.md](licensed-music.md)。本檔原創樂譜及 PCM 測試保留供對照，不再是預設 BGM，也未完成人工聆聽。

# 第一關原創配樂：Cloudline / First Sortie

本輪不借用既有遊戲旋律、音檔或錄音。音符、和聲、合成音色及節奏由本專案程式原創；外部音訊素材數量為零。Kenney 圖像授權不延伸為任何音訊授權。

## 編曲

132 BPM、4/4、十六分音符格。旋律是八小節呼應樂句，不再只有循環高音琶音。分為前奏、主題 A、主題 B（部分升八度）、重裝變奏、喘息與 Boss 專屬四小節動機。

- 旋律：triangle，帶起音、延音及收尾包絡。
- 和聲：三聲部 sine 和弦，較長音值。
- 低音：根音與八度節奏，和弦進行支撐旋律。
- 節奏：原創合成 kick、snare、hat；喘息段減少打擊與旋律密度。
- Boss：另一組旋律與和聲；切換對齊下一小節，最長約 1.82 秒，不重啟 AudioContext 或截斷正在發聲的音符。

這是原創合成配樂，不是正式錄製管弦樂或完整商業混音。

## 整合 API

- 開始按鈕／Enter 的真實使用者手勢中呼叫 `unlock()`。
- 新一局呼叫 `resetMusic()`，再 `setPlaying(true)`。
- 暫停／返回標題／失敗／通關呼叫 `setPlaying(false)`，立即停止與釋放所有活躍節點；暫停後 `setPlaying(true)` 續奏原樂句位置，不重新播放前奏。
- `setMusicContext('flight' | 'pressure' | 'recovery' | 'boss')` 分別選擇正常編曲、重裝、喘息、頭目。顯式 context 優先於舊 `setIntensity(0|1|2)`，避免中頭目誤用 Boss 配樂。
- `update(dt)` 仍用秒；以單一 25ms timer 驅動 AudioContext.currentTime 的 150ms lookahead，最多每輪排 3 格；不由 GPU frame dt 決定拍速。暫停取消 timer 與已排音符，續奏從尚未發聲的下一格開始。重開不累積排程器。JS 主執行緒完全阻塞時略過過期音符，不把漏音塞成爆音或拖慢節拍。
- `setVolumes(music,sfx)`、零音量靜音及現有音效 API 相容；不修改存檔 schema。
- `diagnostics()` 提供 `musicSection`、`musicContext`、`musicBar`、`musicStep`、`notesScheduled`、`sectionTransitionCount`。notesScheduled 計算成功 start 的音樂振盪器，不代表使用者裝置已實際發聲。

音樂最多占用 12 個同時活躍節點，總數上限仍 16，保留音效與受傷提示空間。每顆音符結束會 disconnect；pause/hidden/dispose 也清理。

## 驗證證據入口

`src/game/music-preview.ts` 僅供測試匯入，正式遊戲不引用。`renderMusicPreview()` 使用真正瀏覽器 `OfflineAudioContext`，與正式播放共用 `music-synth.ts` 的音色／包絡程式，輸出六段各四小節之單聲道 22050Hz PCM WAV，以及各段 peak／RMS／非零樣本、排定與結束節點數。約 45 秒，這是取樣展示各段的驗證曲，不等同完整第一關實際遊玩錄音。

Playwright 可用 esbuild 將此 TS 入口 bundle 成 IIFE（globalName `MusicPreview`、write:false），以 `page.addScriptTag({content: ...})` 載入測試頁，再呼叫 `MusicPreview.renderMusicPreview()`；不需要正式頁暴露測試入口。WAV 可保存為 CI artifact，檢查 peak < 1、RMS > 0、各段差異與節點結束數。此計算能證明產生非零波形，不能取代人工聽感。

## 本輪已執行／未執行

- 已通過 19 個音訊與樂譜單元測試，涵蓋分段、旋律／和聲／低音、context 轉換、2／5／16 FPS 的獨立時鐘排程、JS 停頓不追補、30／60／120 FPS 的 75 秒節奏、節點釋放、靜音、暫停、解鎖失敗與既有武器音效。
- TypeScript 檢查通過。
- OfflineAudioContext 的瀏覽器 PCM/WAV 輸出待整合 CI 執行；本文件不將 mock 測試當成實際出聲。
- 未人工試聽；未驗證 iOS Safari 真機。iOS 仍需使用者手勢解鎖，系統靜音、音訊路由或瀏覽器中斷也可能阻止實際聲音；有 running 狀態不代表喇叭可聽。
