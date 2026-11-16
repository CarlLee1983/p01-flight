# G2 素材清單與匯入流程

本輪只替換 Stage 01 視覺，不改波次、75 秒規則、碰撞或存檔。

| 用途     | Kenney 原檔            | 原始尺寸 | 遊戲尺寸          |
| -------- | ---------------------- | -------- | ----------------- |
| 玩家機   | playerShip1_blue.png   | 99×75    | 48×37；選單104×79 |
| 敵機     | Enemies/enemyRed1.png  | 93×84    | 42×38             |
| 玩家子彈 | Lasers/laserBlue01.png | 9×54     | 6×26              |
| 尾焰     | Effects/fire03.png     | 14×34    | 9×約16；旋轉180度 |

全部為 Kenney Space Shooter Remastered（CC0）原檔，保留透明背景。原始頁直接403，改讀官方完整快取及公開鏡像；精確來源、hash、限制見 `asset-sources.json` 與 `licenses/kenney-space-shooter.md`。未假稱從官網直接下載成功。

匯入：選取經核對檔案 → 原樣存 public/assets/kenney → hash/PNG/透明資訊驗證 → Phaser preload → 共用 image 顯示池 → 實頁與遊戲驗證。Origin固定0.5；顯示尺寸不修改 model hitbox；畫面物件依活躍數重用並隱藏不用的槽位。無需為4張圖加入圖集工具。

爆炸／命中採本專案原創程式效果：0.45秒亮芯、擴張圈、八方向火花；背景維持原創程序線條。不是把火焰 PNG 冒充爆炸逐格動畫。沒有音樂／音效、敵彈、新關卡或正式原創戰機動畫。
