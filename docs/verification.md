# G0/G1 驗證紀錄（2026-11-16）

## 已驗證

- Node 24.22.1，npm 11.9.0。
- Phaser 4.2.1、TypeScript 5.7.3、Vite 6.3.1 安裝成功，lockfile 固定精確依賴。
- TypeScript 無錯誤；Vitest 13項單元測試通過；Vite build 輸出純 HTML/CSS/JS。
- 單元測試含八向正規化、邊界、射擊頻率、回收池、單次命中、無敵、75秒勝利、失敗、暫停、重試、存檔還原／壞資料／拒絕寫入。

## 尚未驗證／環境阻礙

- Playwright Chromium 啟動在本機 socket 建立時被 EPERM 阻擋，尚未到遊戲頁面；標準與批准的 escalation 執行皆相同。
- Vite localhost 曾輸出 ready，但服務未持續存在；預覽不可交付。未公開部署。
- 因此瀏覽器可玩性、Chrome/Firefox畫面、實際75秒通關、關閉重開持久化、手感/視覺、10次重玩實際瀏覽器表現皆不能稱通過。
- 已提供可重跑 E2E 與 CI workflow（無部署步驟）。CI 未跑前不能稱通過。
- Vite 提示主 JS bundle 約1.7MB（gzip 約386KB）；尚未調校載入效能。

## 未完成

- G2 正式素材、音效/音樂、手機觸控、後續關卡：依範圍延後。
- 使用者驗收 G1 後才決定後續投入。
