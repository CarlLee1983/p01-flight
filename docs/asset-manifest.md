# G0/G1 素材清單

本版全部為 `src/main.ts` 以 Phaser Graphics 繪製的原創程序幾何圖形，無下載素材、無第三方素材授權負擔。

| ID         | 畫面                           | 生成方式                         |
| ---------- | ------------------------------ | -------------------------------- |
| player     | 青色三角機、中央受擊亮點、尾焰 | triangle/circle                  |
| scout      | 紅橘三角敵機                   | triangle/rectangle               |
| shot       | 青色子彈                       | rounded rectangle                |
| impact     | 黃色擴散命中圈                 | circle/stroke/alpha              |
| background | 深藍縱向線條                   | rectangles/lines，隨模擬時間捲動 |

素材管線：來源程式 → Vite bundle → Phaser Graphics。G2 可把 drawing 換成 texture/sprite，保留同一 model hitbox/座標。尺寸與碰撞獨立；不能因換 PNG 改變命中規則。

候選尚未匯入：Kenney Space Shooter Remastered（CC0）：https://kenney.nl/assets/space-shooter-remastered 。G2 要另保存下載包版本、逐項檔案來源、LICENSE與尺寸，不把此候選標為已整合。
