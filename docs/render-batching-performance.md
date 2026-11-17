# 全域單一批次造成的卡頓：隔離紋理，不拆散所有三角形

Carl 實玩 `3b3bbeb9` 回報非常卡頓。上一輪原生畫面缺塊在
`render.batchSize:1` 的有限樣本未再出現，但這不能當成可接受的修復。
`draw()` 的 CPU 計時只包含建立繪圖命令，不包含 Phaser 後續 GL 提交。

## 已確認的成本機制

固定依賴 Phaser 4.2.1 的 `BatchHandler` 讓各類 node 繼承全域 batchSize。
`BatchHandlerTriFlat` 用於 Graphics，每三角形算一個 instance；大小為1
會每三角形 flush/drawElements。背景、陰影、圓弧與爆炸不應如此拆分。
這是程式碼可核實的 draw-call 放大機制，不是已量到使用者裝置GPU瓶頸。

## 本輪方案，待精確 CI 與目視

- 恢復全域4096批次。
- 使用公開 `setRenderNodeRole('BatchHandler','BatchHandlerQuadSingle')`
  僅隔離 Image/Text 紋理quad，保留此前缺面問題的局部相容性措施。
- Scene ADDED_TO_SCENE 只處理新加入的 Image/Text，沒有逐幀掃描或重建
  紋理；Graphics 不改node。Scene shutdown取消事件。
- 不改生命、敵機數、彈量、關卡排程與特效內容來假裝效能改善。

## 驗證方式與限制

相同正式bundle在測試攔截中比較全域1、紋理局部single、原始正常batch。
測試修改只在測試瀏覽器回應中，不提供遊戲作弊／時間快轉入口。
兩個相同關卡時間窗觀測 WebGL draw calls 與 rAF影格分布；測量期間
不錄影、不截圖。CPU draw命令均值不再當作整體效能指標。
完整正常通關、存檔及原生framebuffer/原始HUD畫布檢查仍需通過。

共享CI瀏覽器不是Carl手機，rAF不是GPU執行時間，draw-call下降也不是
真人流暢保證。缺塊根因仍未知；局部隔離需重新確認ADD亮閃、透明雲、
文字與Boss各狀態，不因一張圖正常就宣稱根治。
