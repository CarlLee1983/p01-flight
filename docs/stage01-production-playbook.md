# 第一關製作手冊：先把一關做好，再複用到下一關

這是 P01 已實作的製作方法與限制，不是通用引擎設計，也不代表 Carl
已驗收第一關。**先由 Carl 實玩確認第一關，再製作第二關與其餘關卡。**
十關是後續方向，不能把素材種類增加或 CI 全綠當成第一關品質已完成。

## 版本與驗證範圍

- 已有基礎：Phaser 4.2.1、TypeScript 5.7.3、Vite 6.3.1，版本固定於
  [package.json](../package.json)／lockfile；純靜態 client、本機存檔。
- 最近已部署基準為 `08c97402ca183b8c16605bc9ba975d6acabd8fc4`：317 項單元、22 項 E2E 通過。PR CI [44037935620](https://github.com/CarlLee1983/p01-flight/actions/runs/44037935620)、artifact `14308343898`。部署後預覽連線逾時，不能稱部署站再度人工操作通過。
- 本輪正在重做護航機／巡邏艦／空中砲艇視覺，以及所有敵方逐項盤點。
  **本輪新 head 尚待整合與驗收**，不能沿用上一版通過數字當成驗證結果。
- [敵方逐項盤點](enemy-presentation-audit.md) 是修改前快照；確認修復後要
  更新結果，不要刪除「曾經發生什麼」的歷史。

## 可複用的不是散落圖片，而是完整元件契約

### 敵機：外形、炮口與行為一起交付

第一關有 399 架空中戰鬥單位、6 架補給機，另有地面目標、巡邏艦與 Boss。
[stage.ts](../src/data/stage.ts) 保存波次，
[model.ts](../src/game/model.ts) 保存碰撞、鎖定與攻擊，
[enemy-patterns.ts](../src/game/enemy-patterns.ts) 保存方向差異。
不要為了填滿畫面重複增加同一種進場線。

- 一套敵機交付「完整輪廓、顯示尺寸、局部炮口、引擎位置、受擊狀態、
  擊破效果、行為參數」，不交付 PNG 加幾塊不同畫風的矩形翅膀。
- 新雙炮機已有可複用範例：
  [raider-geometry.ts](../src/game/raider-geometry.ts) 的 48×42 顯示尺寸、
  炮口 ±9/y+20、引擎 ±7/y−15，由 art／提示／model 共用。
  [raider-art.ts](../src/game/raider-art.ts) 在載入時生成 96×84 原創貼圖。
- 「移動方向」「機體轉角」「射線鎖角」是三個不同數值。只旋轉 sprite，
  不旋轉炮口與掛件，會讓子彈從空中出現。沒有一致轉換前，寧可維持
  向下的完整機體，讓移動曲線表達轉彎。
- 角色要有打法差異：煞停突擊機短暫停留再離場；鉤翼機內切再外轉、
  兩輪鏡像斜射。它們各替換 6 架既有敵機，放在 67 秒後，避免突然破壞
  前段學習節奏。見 [enemy-roles-and-modules.md](enemy-roles-and-modules.md)。

### 地面目標：底座、旋轉頭與背景不是一張圖

[ground-art.ts](../src/game/ground-art.ts)、
[hostile-visuals.ts](../src/game/hostile-visuals.ts) 與
[rotating-turret-assets.md](rotating-turret-assets.md) 是現有契約。
地面底座顯示 72×72，砲頭 48×48；砲口以朝下為零角、距離中心 20 px。
固定底座不跟著瞄準旋轉，砲頭、蓄力、首發與尾發必須共用來源位置。
地面目標沿場景以 32 px/s 滾動，進入 y108 可互動區後才成為有效目標。

加入下一張地圖時先確認「地圖上畫的砲台」與「可破壞砲台」不重影。
受擊要能辨識哪個部件被打中，壞掉後應有可讀的殘骸，而非無理由消失。

### 武器與補給：形狀、名稱、安裝結果都要清楚

[pickup-art.ts](../src/game/pickup-art.ts) 為 32×32 機械補給圖標，
[pickup-labels.ts](../src/game/pickup-labels.ts) 提供名稱貼圖；
[weapon-capsules.md](weapon-capsules.md)、
[pickup-identification.md](pickup-identification.md) 記錄識別與撿取表現。
散射、光束、追蹤飛彈、火力升級、修復與支援不能只靠色相區別。
撿取後的短安裝動畫是回饋，不是爆炸；標籤和掉落本體也不能擋住敵彈。

### 場景：連續路線而非一張背景上下平移

[background.ts](../src/game/background.ts)、
[coastal-production.md](coastal-production.md)、
[scrolling-combat.md](scrolling-combat.md)、
[cloud-texture-art.md](cloud-texture-art.md) 保存現有海岸／港區與雲層做法。
檢查起點、港區、煉油區、出港到 Boss 之前的接縫和視覺連續性，不能只
截第一張漂亮畫面。裝飾物不應像可碰撞敵人；高對比雲層不能搶過彈藥。
資產來源與授權保留在 [asset-manifest.md](asset-manifest.md)、
[asset-sources.json](asset-sources.json)、[licenses](licenses)。

## 攻擊節奏：高彈量不等於同一條線塞滿

曾把快速移動敵機的尾發間隔壓到 0.12 秒，機體速度超過子彈速度，使後發
追撞前發，看起來像一條厚線。修正是同步雙炮與不同角度，不是只換顏色。
慢速發射者才使用能看出間距的脈衝；Boss 尾發仍沿已預告方向，不暗中重瞄。

[enemy-pattern-readability.md](enemy-pattern-readability.md)、
[burst-density.md](burst-density.md)、
[boss-side-targets.md](boss-side-targets.md) 保留比較方法。
每次改攻擊同時量測「發射數、場上峰值、軌跡重疊、玩家區域的空隙」；
總發射數增加不保證玩家區域更有壓力，也不保證有趣。

不要在前幾秒同時介紹新角色、加速度、瞄準與密集彈幕。每段應有登場、
辨識、應對、獎勵與喘息。保留 Boss 前補給窗口，並用真實射擊路線驗證
精英是否活得夠久讓玩家看見它的機制。

## 動畫、命中與聲音

[impact-art.ts](../src/game/impact-art.ts) 與 [impact-art.md](impact-art.md)
保存命中 0.25 秒、擊破 0.45 秒、Boss 0.6 秒的時序：亮核、非對稱有體積
火團、碎片、低透明煙。固定 seed 使逐幀連續，不每幀重新亂數。
同函式幀序在 [impact-contact-sheet.svg](impact-contact-sheet.svg)，不能
把它當成實際遊戲影片。機體短亮閃與火團是兩層不同回饋。

[audio.ts](../src/game/audio.ts)、[music.ts](../src/game/music.ts)、
[music-synth.ts](../src/game/music-synth.ts)、[audio-score.md](audio-score.md)
是聲音入口。保留首次手勢解鎖、靜音設定、暫停與恢復；不要只確認音訊
節點建立成功，要實際聽背景音樂是否循環、射擊是否淹沒命中與警報。
自動化證明能解鎖播放，不等於音樂品質、混音與疲勞感已驗收。

## 圖層品質底線

目前既有契約為：背景0、一般敵機1、Boss側炮2、補給名稱2.5、爆炸2.7、
敵彈3、HUD4.5、文字5。實作曾有護航／巡邏機及補給圖標用 depth4 的例外，
會真的遮彈，不因 draw loop 在後面就消失。本輪已降至敵彈之下；詳見逐項盤點與最後版本的實頁驗證。

同一 Graphics 裡後畫的血條／裝飾也會蓋前面敵彈。人工驗收必須看子彈
穿越大型機體、火團、補給與港區陰影，不能只查深度常數的單元測試。

## 手機與 CI：證據分開，不互相冒充

- [touch-input.ts](../src/game/touch-input.ts) 的相對手指位移、上限速度、
  目標自停、次要手指炸彈、旋轉取消手勢，要獨立驗證。
- [touch-test-pilot.md](touch-test-pilot.md) 記錄為何舊測試駕駛會撞彈：
  用連續鍵盤方向去選 16 px 觸控目標，卻忽略抵達後會停住。現在模型
  測試同時檢查移動路段與停住後的相對運動；沒有改血量或放慢時間。
- 模型通關是模型證據。CDP 真觸控 E2E 是瀏覽器證據；手機 viewport
  仍不等於實體 iPhone/Android 的手感、音效與持續效能。
- 不能測試失敗就加無敵、減彈量、放寬通關狀態，或刪掉受傷斷言。
  先分辨真遊戲退步、測試駕駛不符輸入語義、環境啟動問題。

[check.yml](../.github/workflows/check.yml) 用 Node24，依序 npm ci、
typecheck、unit、build、安裝 Chromium/Firefox/WebKit、E2E。artifact含
報告、影片、截圖與 dist。修改後以**最後精確 PR head**的整套結果為準；
不要拿前一版全綠或部署成功代替本版檢查。測試每次重開也要驗證狀態清除，
關閉／重載後最高分與通關紀錄仍保留。

## 每次交付前的人工品質門檻

1. 所有第一關實際出現的敵種逐一看進場、攻擊、命中、擊破；不只看新敵機。
2. 機體與炮口對得上，陰影跟得上，沒有浮空翼片、重疊槍管與閃光穿幫。
3. 中段仍有可讀的節奏變化，敵彈在密集火力與爆炸中清楚，Boss前地圖完整。
4. 真的用正常操作完成通關、失敗、重新開始與本機紀錄重載。
5. 提交資料分列「已驗」「未驗」「待 Carl 實玩」；記錄精確版本與影片時間。

下一關可以複用資產契約、攻擊元件、關卡資料、音效入口、觸控與驗收流程；
不複製本關已知瑕疵，也不為未來十關先建通用 ECS 或大改整個引擎。

## Audit follow-up decision

Do not treat a muzzle correction as automatically cosmetic. Moving a projectile's
origin can alter survival even when speed/count/damage are unchanged. In this
review, a combined origin rewrite changed baseline damage and one20FPS route.
The correction was split and tested: patrol origin now matches real barrels;
escort art instead matches the established central fan. Preserve this distinction
in future reviews and describe trajectory changes honestly. Current new-head CI
and Carl's first-stage acceptance remain pending; do not start Stage02 from this
checklist alone.
