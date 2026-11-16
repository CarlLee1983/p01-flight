import Phaser from "phaser";
import { stage01 } from "./data/stage";
import { FlightModel, type Mode } from "./game/model";
import { BrowserSaveRepository } from "./storage/save";
import "./style.css";
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {}
const saves = new BrowserSaveRepository(storage);
const model = new FlightModel(stage01);
const panel = document.querySelector<HTMLElement>("#panel")!;
let lastMode: Mode | null = null;
let recorded = false;
let graphics: Phaser.GameObjects.Graphics;
let label: Phaser.GameObjects.Text;
function start() {
  model.start();
  recorded = false;
  renderPanel();
}
function renderPanel() {
  const record = saves.data.stages[stage01.id];
  const warning = saves.warning
    ? `<p class="notice" role="status">${saves.warning}</p>`
    : "";
  if (model.mode === "menu")
    panel.innerHTML = `<h2>Stage 01</h2><p>在 75 秒航程中擊落敵機，保持存活。</p><p>最高分 <strong class="stat">${record?.bestScore ?? 0}</strong></p><p>${record?.cleared ? "已通關" : "尚未通關"} · 通關 ${record?.clearCount ?? 0} 次</p><button id="start">開始飛行</button><details><summary>設定與本機紀錄</summary><p class="help">音量偏好會保存；G1 尚無音樂／音效。</p><label>音樂<input id="music" type="range" min="0" max="1" step=".1" value="${saves.data.settings.musicVolume}"></label><label>音效<input id="sfx" type="range" min="0" max="1" step=".1" value="${saves.data.settings.sfxVolume}"></label><button id="reset" class="secondary">重設本機紀錄</button></details>${warning}`;
  else if (model.mode === "playing" || model.mode === "paused")
    panel.innerHTML = `<h2>${model.mode === "paused" ? "暫停中" : "航程進行中"}</h2><p>躲避紅色敵機，按住 Space 或 Z 射擊。</p><p>藍色戰機中央亮點是受擊區。</p><button id="pause">${model.mode === "paused" ? "繼續" : "暫停"}</button><button id="menu" class="secondary">返回標題</button><p class="help">離開分頁會自動暫停。未完成航程不會寫入結算。</p>${warning}`;
  else
    panel.innerHTML = `<h2>${model.mode === "won" ? "Stage 01 通關" : "飛行結束"}</h2><p class="stat">${model.score} 分</p><p>航程 ${model.time.toFixed(1)} / 75 秒</p><p>最高分 ${record?.bestScore ?? 0} · 通關 ${record?.clearCount ?? 0} 次</p><button id="retry">再飛一次</button><button id="menu" class="secondary">返回標題</button>${warning}`;
  document.querySelector("#start")?.addEventListener("click", start);
  document.querySelector("#retry")?.addEventListener("click", start);
  document.querySelector("#pause")?.addEventListener("click", () => {
    model.pause();
    renderPanel();
  });
  document.querySelector("#menu")?.addEventListener("click", () => {
    model.mode = "menu";
    renderPanel();
  });
  for (const id of ["music", "sfx"])
    document.querySelector("#" + id)?.addEventListener("input", () => {
      saves.settings(
        Number((document.querySelector("#music") as HTMLInputElement).value),
        Number((document.querySelector("#sfx") as HTMLInputElement).value),
      );
      let notice = panel.querySelector<HTMLElement>('[role="status"]');
      if (!notice) {
        notice = document.createElement("p");
        notice.className = "notice";
        notice.setAttribute("role", "status");
        panel.append(notice);
      }
      notice.textContent = saves.warning;
    });
  document.querySelector("#reset")?.addEventListener("click", () => {
    if (confirm("清除本機最高分、通關與設定？")) {
      saves.reset();
      renderPanel();
    }
  });
  lastMode = model.mode;
}
class FlightScene extends Phaser.Scene {
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  create() {
    graphics = this.add.graphics();
    label = this.add
      .text(16, 14, "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#d7f9ff",
      })
      .setDepth(5);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Z,ENTER,P",
    ) as typeof this.keys;
    this.input.keyboard!.disableGlobalCapture();
    // Handle edge-triggered actions on keydown so a press released between
    // render frames is not lost. Ignore OS key-repeat to avoid pause toggles.
    this.input.keyboard!.on("keydown-P", (event: KeyboardEvent) => {
      if (!event.repeat) {
        model.pause();
        renderPanel();
      }
    });
    renderPanel();
  }
  update(_time: number, delta: number) {
    if (model.mode === "playing") this.input.keyboard!.enableGlobalCapture();
    else this.input.keyboard!.disableGlobalCapture();
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.ENTER) &&
      ["menu", "won", "lost"].includes(model.mode)
    )
      start();
    const on = (...names: string[]) =>
      names.some((k) => this.keys[k].isDown) ? 1 : 0;
    model.update(
      delta / 1000,
      on("D", "RIGHT") - on("A", "LEFT"),
      on("S", "DOWN") - on("W", "UP"),
      !!on("SPACE", "Z"),
    );
    if ((model.mode === "won" || model.mode === "lost") && !recorded) {
      recorded = true;
      saves.record(stage01.id, model.score, model.mode === "won");
    }
    if (model.mode !== lastMode) renderPanel();
    this.draw();
  }
  draw() {
    graphics.clear();
    graphics.fillStyle(0x0c2035);
    graphics.fillRect(0, 0, 360, 640);
    for (let i = 0; i < 30; i++) {
      const x = (i * 137) % 360,
        y = ((i * 79 + model.time * 65) % 680) - 20;
      graphics.fillStyle(i % 3 === 0 ? 0x38637d : 0x163a52, 0.8);
      graphics.fillRect(x, y, 2, i % 3 === 0 ? 18 : 5);
    }
    graphics.lineStyle(1, 0x22445d, 0.5);
    for (let y = -80; y < 700; y += 80) {
      graphics.lineBetween(
        0,
        y + ((model.time * 35) % 80),
        360,
        y + ((model.time * 35) % 80),
      );
    }
    if (model.mode !== "menu") {
      for (const b of model.bullets)
        if (b.active) {
          graphics.fillStyle(0x9ffff1);
          graphics.fillRoundedRect(b.x - 3, b.y - 10, 6, 20, 2);
        }
      for (const e of model.enemies)
        if (e.active) {
          graphics.fillStyle(e.hp > 1 ? 0xffb36b : 0xf36f83);
          graphics.fillTriangle(
            e.x,
            e.y + 22,
            e.x - 20,
            e.y - 13,
            e.x + 20,
            e.y - 13,
          );
          graphics.fillStyle(0x742b48);
          graphics.fillRect(e.x - 5, e.y - 12, 10, 19);
        }
      const p = model.player;
      if (model.invincible <= 0 || Math.floor(model.time * 14) % 2 === 0) {
        graphics.fillStyle(0x66ddd8);
        graphics.fillTriangle(
          p.x,
          p.y - 25,
          p.x - 20,
          p.y + 18,
          p.x + 20,
          p.y + 18,
        );
        graphics.fillStyle(0xefffff);
        graphics.fillCircle(p.x, p.y, 5);
        graphics.fillStyle(0xffc36e);
        graphics.fillTriangle(
          p.x - 5,
          p.y + 17,
          p.x + 5,
          p.y + 17,
          p.x,
          p.y + 27,
        );
      }
      for (const e of model.effects) {
        graphics.lineStyle(3, 0xffd58a, Math.min(1, e.life * 4));
        graphics.strokeCircle(e.x, e.y, (0.45 - e.life) * 60);
      }
    } else {
      graphics.fillStyle(0x66ddd8);
      graphics.fillTriangle(180, 260, 140, 345, 220, 345);
      graphics.fillStyle(0xeaffff);
      graphics.fillCircle(180, 310, 10);
    }
    label.setText(
      model.mode === "menu"
        ? "P01  /  FLIGHT LAB\n\nREADY FOR TAKEOFF"
        : `SCORE ${String(model.score).padStart(6, "0")}    LIFE ${"♥".repeat(Math.max(0, model.hp))}\nSTAGE 01   ${Math.ceil(stage01.duration - model.time)}s`,
    );
    if (model.mode === "paused") {
      graphics.fillStyle(0x000000, 0.5);
      graphics.fillRect(0, 65, 360, 575);
    }
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  parent: "game",
  backgroundColor: "#0c2035",
  scene: [FlightScene],
  render: { pixelArt: true },
  fps: { target: 60 },
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && model.mode === "playing") {
    model.pause();
    renderPanel();
  }
});
// Read-only diagnostics used by browser tests; no bypass of damage or stage time.
Object.defineProperty(window, "__P01__", {
  value: () => ({
    mode: model.mode,
    time: model.time,
    score: model.score,
    hp: model.hp,
    player: { ...model.player },
    bullets: model.bullets.filter((b) => b.active).length,
    enemies: model.enemies.filter((e) => e.active).length,
    bulletPool: model.bullets.length,
    enemyPool: model.enemies.length,
    shots: model.shots,
    save: saves.data,
  }),
});
