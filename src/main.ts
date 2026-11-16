import Phaser from "phaser";
import { stage01 } from "./data/stage";
import { FlightModel, type Mode } from "./game/model";
import { BrowserSaveRepository } from "./storage/save";
import { FlightAudio } from "./game/audio";
import "./style.css";
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {}
const saves = new BrowserSaveRepository(storage);
const model = new FlightModel(stage01);
const audio = new FlightAudio();
let previous = { shots: 0, kills: 0, hurt: 0, pickup: 0, phase: 0 };
const panel = document.querySelector<HTMLElement>("#panel")!;
let lastMode: Mode | null = null;
let recorded = false;
let graphics: Phaser.GameObjects.Graphics;
let label: Phaser.GameObjects.Text;
let overlay: Phaser.GameObjects.Graphics;
let title: Phaser.GameObjects.Text;
let subtitle: Phaser.GameObjects.Text;
function start() {
  void audio.unlock();
  previous = { shots: 0, kills: 0, hurt: 0, pickup: 0, phase: 0 };
  model.start();
  recorded = false;
  renderPanel();
}
function renderPanel() {
  panel.dataset.mode = model.mode;
  const record = saves.data.stages[stage01.id];
  const warning = saves.warning
    ? `<p class="notice" role="status">${saves.warning}</p>`
    : "";
  if (model.mode === "menu")
    panel.innerHTML = `<h2>Stage 01</h2><p>穿越沿岸防線，在 75 秒內擊破三階段指揮艦。收集金色能量，將主炮升至三向、五向散射。</p><p>最高分 <strong class="stat">${record?.bestScore ?? 0}</strong></p><p>${record?.cleared ? "已通關" : "尚未通關"} · 通關 ${record?.clearCount ?? 0} 次</p><button id="start">開始飛行</button><details><summary>設定與本機紀錄</summary><p class="help">原創電子節奏與音效。音量設為 0 即靜音，設定保存在本機。</p><label>音樂<input id="music" type="range" min="0" max="1" step=".1" value="${saves.data.settings.musicVolume}"></label><label>音效<input id="sfx" type="range" min="0" max="1" step=".1" value="${saves.data.settings.sfxVolume}"></label><button id="reset" class="secondary">重設本機紀錄</button></details>${warning}`;
  else if (model.mode === "playing" || model.mode === "paused")
    panel.innerHTML = `<h2>${model.mode === "paused" ? "暫停中" : "航程進行中"}</h2><p>按住 Space／Z 射擊。留意蓄力光圈，側移躲開瞄準彈。</p><p>金色能量永久升級主炮；青色十字補血。<br><b>X：衝擊炸彈 ×2</b>，清除敵彈並重創敵機。</p><button id="pause">${model.mode === "paused" ? "繼續" : "暫停"}</button><button id="menu" class="secondary">返回標題</button><p class="help">離開分頁會自動暫停。未完成航程不會寫入結算。</p>${warning}`;
  else
    panel.innerHTML = `<h2>${model.mode === "won" ? "Stage 01 通關" : model.lostReason === "timeout" ? "頭目突圍，任務失敗" : "飛行結束"}</h2><p class="stat">${model.score} 分</p><p>航程 ${model.time.toFixed(1)} / 75 秒</p><p>最高分 ${record?.bestScore ?? 0} · 通關 ${record?.clearCount ?? 0} 次</p><button id="retry">再飛一次</button><button id="menu" class="secondary">返回標題</button>${warning}`;
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
      void audio.unlock();
      audio.setVolumes(
        saves.data.settings.musicVolume,
        saves.data.settings.sfxVolume,
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
  const mute = document.createElement("button");
  mute.className = "secondary";
  mute.id = "mute";
  mute.textContent =
    saves.data.settings.musicVolume === 0 && saves.data.settings.sfxVolume === 0
      ? "開啟聲音"
      : "全部靜音";
  mute.onclick = () => {
    const silent =
      saves.data.settings.musicVolume === 0 &&
      saves.data.settings.sfxVolume === 0;
    saves.settings(silent ? 0.6 : 0, silent ? 0.8 : 0);
    void audio.unlock();
    renderPanel();
  };
  panel.append(mute);
  audio.setVolumes(
    saves.data.settings.musicVolume,
    saves.data.settings.sfxVolume,
  );
  audio.setPlaying(model.mode === "playing");
  lastMode = model.mode;
}
class FlightScene extends Phaser.Scene {
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  visuals: Phaser.GameObjects.Image[] = [];
  visualIndex = 0;
  preload() {
    for (const file of [
      "playerShip1_blue",
      "enemyRed1",
      "laserBlue01",
      "fire03",
    ])
      this.load.image(
        file,
        `${import.meta.env.BASE_URL}assets/kenney/${file}.png`,
      );
  }
  sprite(
    key: string,
    x: number,
    y: number,
    width: number,
    height: number,
    alpha = 1,
    angle = 0,
  ) {
    let image = this.visuals[this.visualIndex++];
    if (!image) {
      image = this.add.image(x, y, key).setDepth(1);
      this.visuals.push(image);
    }
    image
      .setTexture(key)
      .setPosition(x, y)
      .setDisplaySize(width, height)
      .setOrigin(0.5)
      .setAlpha(alpha)
      .setAngle(angle)
      .setVisible(true)
      .clearTint();
    return image;
  }
  create() {
    graphics = this.add.graphics();
    overlay = this.add.graphics().setDepth(3);
    title = this.add
      .text(180, 180, "", {
        fontFamily: "sans-serif",
        fontSize: "38px",
        fontStyle: "bold",
        color: "#f0f5dd",
        stroke: "#071b29",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(6);
    subtitle = this.add
      .text(180, 228, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#8bf3da",
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5)
      .setDepth(6);
    label = this.add
      .text(16, 14, "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#d7f9ff",
      })
      .setDepth(5);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Z,ENTER,P,X",
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
    this.input.keyboard!.on("keydown-ENTER", (event: KeyboardEvent) => {
      if (!event.repeat && ["menu", "won", "lost"].includes(model.mode))
        start();
    });
    this.input.keyboard!.on("keydown-X", (event: KeyboardEvent) => {
      if (!event.repeat && model.useBomb()) {
        audio.play("bomb");
        this.cameras.main.shake(180, 0.008);
      }
    });
    renderPanel();
  }
  update(_time: number, delta: number) {
    if (model.mode === "playing") this.input.keyboard!.enableGlobalCapture();
    else this.input.keyboard!.disableGlobalCapture();
    const on = (...names: string[]) =>
      names.some((k) => this.keys[k].isDown) ? 1 : 0;
    model.update(
      delta / 1000,
      on("D", "RIGHT") - on("A", "LEFT"),
      on("S", "DOWN") - on("W", "UP"),
      !!on("SPACE", "Z"),
    );
    if (model.shots > previous.shots) audio.play("shot");
    if (model.killCount > previous.kills) audio.play("explode");
    if (model.damageCount > previous.hurt) {
      audio.play("hurt");
      this.cameras.main.shake(140, 0.006);
    }
    if (model.pickupCount > previous.pickup) audio.play("power");
    if ((model.boss?.phase ?? 0) > previous.phase) audio.play("phase");
    previous = {
      shots: model.shots,
      kills: model.killCount,
      hurt: model.damageCount,
      pickup: model.pickupCount,
      phase: model.boss?.phase ?? 0,
    };
    audio.update(delta / 1000);
    if ((model.mode === "won" || model.mode === "lost") && !recorded) {
      recorded = true;
      saves.record(stage01.id, model.score, model.mode === "won");
    }
    if (model.mode !== lastMode) {
      renderPanel();
      if (model.mode === "won" || model.mode === "lost") audio.play(model.mode);
    }
    this.draw();
  }
  draw() {
    const splash =
      model.mode === "menu" || model.mode === "won" || model.mode === "lost";
    title.setVisible(splash);
    subtitle.setVisible(splash);
    title.setText(
      model.mode === "menu"
        ? "雲際航線"
        : model.mode === "won"
          ? "任務完成"
          : "任務失敗",
    );
    title.setColor(model.mode === "lost" ? "#ffb18f" : "#f0f5dd");
    subtitle.setText(
      model.mode === "menu"
        ? "COASTAL STRIKE / 01\nPRESS ENTER TO LAUNCH"
        : model.mode === "won"
          ? "COMMAND SHIP DESTROYED\nPRESS ENTER TO RETRY"
          : "REGROUP AND RETURN\nPRESS ENTER TO RETRY",
    );
    this.visualIndex = 0;
    for (const image of this.visuals) image.setVisible(false);
    graphics.clear();
    overlay.clear();
    graphics.fillStyle(0x092b3c);
    graphics.fillRect(0, 0, 360, 640);
    for (let i = 0; i < 30; i++) {
      const x = (i * 137) % 360,
        y = ((i * 79 + model.time * 65) % 680) - 20;
      graphics.fillStyle(i % 3 === 0 ? 0x38637d : 0x163a52, 0.8);
      graphics.fillRect(x, y, 2, i % 3 === 0 ? 18 : 5);
    }
    // Original coastal silhouettes, breakwaters and foam scroll beneath combat.
    for (let i = 0; i < 5; i++) {
      const y = ((i * 190 + model.time * 48) % 1000) - 180;
      const x = i % 2 ? 335 : 12;
      graphics.fillStyle(0x174942);
      graphics.fillEllipse(x, y, 125, 220);
      graphics.fillStyle(0x226052, 0.6);
      graphics.fillEllipse(x + (i % 2 ? 18 : -18), y - 15, 100, 170);
      graphics.lineStyle(2, 0x5b9b96, 0.3);
      graphics.strokeEllipse(x, y, 140, 232);
      graphics.fillStyle(0x516269);
      graphics.fillRect(x - 20, y - 30, 40, 65);
      graphics.fillStyle(0x889083);
      graphics.fillRect(x - 15, y - 25, 30, 50);
    }
    if (model.mode !== "menu") {
      for (const b of model.bullets)
        if (b.active) {
          this.sprite(
            "laserBlue01",
            b.x,
            b.y,
            model.weaponLevel === 3 ? 8 : 6,
            model.weaponLevel === 3 ? 34 : 26,
            1,
            (Math.atan2(b.vx ?? 0, -(b.vy ?? -550)) * 180) / Math.PI,
          ).setTint(model.weaponLevel === 3 ? 0xffed9e : 0xffffff);
        }
      for (const e of model.enemies)
        if (e.active) {
          this.sprite(
            "enemyRed1",
            e.x,
            e.y,
            e.behavior === "turret" ? 58 : e.behavior === "weave" ? 34 : 42,
            e.behavior === "turret" ? 52 : 38,
            1,
            e.behavior === "weave" ? Math.sin((e.age ?? 0) * 2.6) * 18 : 0,
          ).setTint(
            e.behavior === "turret"
              ? 0xd890ff
              : e.behavior === "weave"
                ? 0xffd18c
                : 0xffffff,
          );
          if ((e.telegraph ?? 0) > 0) {
            overlay.lineStyle(2, 0xffbd69, 0.8);
            overlay.strokeCircle(
              e.x,
              e.y + 17,
              9 + Math.sin(model.time * 20) * 3,
            );
          }
          if (e.behavior === "turret") {
            overlay.fillStyle(0x937bd8);
            overlay.fillRect(e.x - 25, e.y, 8, 23);
            overlay.fillRect(e.x + 17, e.y, 8, 23);
          }
        }
      for (const shot of model.enemyBullets)
        if (shot.active) {
          overlay.fillStyle(0xff5f9e);
          overlay.fillCircle(shot.x, shot.y, 5);
          overlay.lineStyle(1.5, 0xffe2ed);
          overlay.strokeCircle(shot.x, shot.y, 5);
        }
      for (const pickup of model.pickups)
        if (pickup.active) {
          const heal = pickup.kind === "heal";
          overlay.fillStyle(heal ? 0x164d50 : 0x715624, 0.9);
          overlay.fillRoundedRect(pickup.x - 12, pickup.y - 12, 24, 24, 5);
          overlay.lineStyle(2, heal ? 0x72ffe2 : 0xffd66e);
          overlay.strokeRoundedRect(pickup.x - 12, pickup.y - 12, 24, 24, 5);
          if (heal) {
            overlay.lineBetween(pickup.x - 6, pickup.y, pickup.x + 6, pickup.y);
            overlay.lineBetween(pickup.x, pickup.y - 6, pickup.x, pickup.y + 6);
          } else {
            overlay.lineBetween(
              pickup.x - 4,
              pickup.y - 6,
              pickup.x - 4,
              pickup.y + 6,
            );
            overlay.lineBetween(
              pickup.x + 4,
              pickup.y - 6,
              pickup.x + 4,
              pickup.y + 6,
            );
          }
        }
      if (model.boss?.active) {
        this.sprite("enemyRed1", model.boss.x, model.boss.y, 100, 74).setTint(
          0xff89bb,
        );
        this.sprite(
          "enemyRed1",
          model.boss.x - 49,
          model.boss.y + 8,
          37,
          51,
        ).setTint(0x8b83cf);
        this.sprite(
          "enemyRed1",
          model.boss.x + 49,
          model.boss.y + 8,
          37,
          51,
        ).setTint(0x8b83cf);
        if (model.boss.telegraph > 0) {
          overlay.lineStyle(3, 0xffd179, 0.8);
          overlay.strokeCircle(
            model.boss.x,
            model.boss.y,
            48 + Math.sin(model.time * 20) * 5,
          );
        }
        overlay.fillStyle(0x421f3c);
        overlay.fillRect(16, 76, 328, 7);
        overlay.fillStyle(0xff83b9);
        overlay.fillRect(
          16,
          76,
          328 * Math.max(0, model.boss.hp / model.boss.maxHp),
          7,
        );
      }
      const p = model.player;
      if (model.invincible <= 0 || Math.floor(model.time * 14) % 2 === 0) {
        this.sprite("playerShip1_blue", p.x, p.y, 36, 28);
        this.sprite(
          "fire03",
          p.x,
          p.y + 21,
          9,
          16 + Math.sin(model.time * 45) * 3,
          0.85,
          180,
        );
        // The original collision rules stay in FlightModel, independent of art.
      }
      for (const e of model.effects) {
        const progress = 1 - e.life / 0.45;
        graphics.lineStyle(3 * (1 - progress) + 1, 0xffd58a, 1 - progress);
        graphics.strokeCircle(e.x, e.y, 4 + progress * 29);
        graphics.fillStyle(0xfff5cb, Math.max(0, 1 - progress * 2));
        graphics.fillCircle(e.x, e.y, 11 * (1 - progress));
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          graphics.lineStyle(2, i % 2 ? 0xffa54c : 0xffecaa, 1 - progress);
          graphics.lineBetween(
            e.x + Math.cos(angle) * progress * 15,
            e.y + Math.sin(angle) * progress * 15,
            e.x + Math.cos(angle) * (8 + progress * 35),
            e.y + Math.sin(angle) * (8 + progress * 35),
          );
        }
      }
    } else {
      graphics.lineStyle(1, 0x7de7d5, 0.3);
      graphics.strokeCircle(180, 390, 94);
      graphics.strokeCircle(180, 390, 115);
      graphics.lineBetween(180, 265, 180, 520);
      graphics.lineBetween(55, 390, 305, 390);
      this.sprite("playerShip1_blue", 180, 390, 104, 79);
      this.sprite("fire03", 180, 445, 18, 36, 0.9, 180);
    }
    if (model.mode !== "menu") {
      overlay.fillStyle(0x0c2133, 0.96);
      overlay.fillRect(0, 0, 360, 72);
    }
    label.setText(
      model.mode === "menu"
        ? "P01 / COASTAL STRIKE\nFLIGHT SYSTEM ONLINE"
        : `SCORE ${String(model.score).padStart(6, "0")}    LIFE ${"♥".repeat(Math.max(0, model.hp))}\n${model.mode === "won" ? "STAGE CLEAR" : model.mode === "lost" ? "MISSION FAILED" : model.boss?.active ? "BOSS P" + model.boss.phase : model.time > 50 ? "BOSS INCOMING" : "STAGE 01"}   ${Math.ceil(stage01.duration - model.time)}s\nPOWER ${model.weaponLevel}/3    BOMB ${model.bombs} [X]`,
    );
    if (model.bombFlash > 0) {
      overlay.fillStyle(0xb8f8ff, Math.min(0.25, model.bombFlash * 0.25));
      overlay.fillRect(0, 72, 360, 568);
      overlay.lineStyle(5, 0xc7faff, Math.min(1, model.bombFlash));
      overlay.strokeCircle(
        model.player.x,
        model.player.y,
        (1 - Math.min(1, model.bombFlash)) * 700,
      );
    }
    if (model.mode === "paused") {
      overlay.fillStyle(0x000000, 0.65);
      overlay.fillRect(0, 70, 360, 570);
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
    enemyBullets: model.enemyBullets.filter((b) => b.active).length,
    pickups: model.pickups.filter((p) => p.active).length,
    boss: model.boss ? { ...model.boss } : null,
    bossDefeated: model.bossDefeated,
    weaponTime: model.weaponTime,
    weaponLevel: model.weaponLevel,
    bombs: model.bombs,
    audio: audio.diagnostics(),
    lostReason: model.lostReason,
    save: saves.data,
  }),
});
