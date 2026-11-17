import Phaser from "phaser";
import { stage01, GROUND_VISIBLE_Y } from "./data/stage";
import { FlightModel, type Mode } from "./game/model";
import { BrowserSaveRepository } from "./storage/save";
import { FlightAudio } from "./game/audio";
import { advanceFrame } from "./game/frame-step";
import { CoastalBackground } from "./game/background";
import { createPickupTextures, pickupVisual } from "./game/pickup-art";
import { TouchInput } from "./game/touch-input";
import { RenderMetrics } from "./game/render-metrics";
import "./style.css";
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {}
const saves = new BrowserSaveRepository(storage);
const model = new FlightModel(stage01);
const audio = new FlightAudio();
const touch = new TouchInput();
let previous = { shots: 0, kills: 0, hurt: 0, pickup: 0, phase: 0, parts: 0 };
const panel = document.querySelector<HTMLElement>("#panel")!;
let lastMode: Mode | null = null;
let recorded = false;
let graphics: Phaser.GameObjects.Graphics;
let label: Phaser.GameObjects.Text;
let overlay: Phaser.GameObjects.Graphics;
let readBackgroundInfo: () => Record<string, unknown> = () => ({});
const renderMetrics = new RenderMetrics();
let frameCount = 0,
  frameTime = 0;
// pointerdown supports a second finger while the first one is captured on canvas.
// Keyboard/screen-reader generated clicks (detail=0) remain accessible, without
// executing the following synthetic touch click a second time.
function bindTouchAction(id: string, action: () => void) {
  const button = document.getElementById(id) as HTMLButtonElement | null;
  button?.addEventListener("pointerdown", (event) => {
    if (button.disabled) return;
    event.preventDefault();
    action();
  });
  button?.addEventListener("click", (event) => {
    if (event.detail === 0 && !button.disabled) action();
  });
}
function start() {
  touch.cancel();
  void audio.unlock();
  previous = { shots: 0, kills: 0, hurt: 0, pickup: 0, phase: 0, parts: 0 };
  model.start();
  audio.resetMusic();
  renderMetrics.reset();
  recorded = false;
  renderPanel();
}
function renderPanel() {
  panel.dataset.mode = model.mode;
  if (model.mode !== "playing") touch.cancel();
  for (const id of ["touch-bomb", "touch-weapon"]) {
    const button = document.getElementById(id) as HTMLButtonElement | null;
    if (button) button.disabled = model.mode !== "playing";
  }
  const pause = document.getElementById(
    "touch-pause",
  ) as HTMLButtonElement | null;
  if (pause) {
    pause.disabled = !["playing", "paused"].includes(model.mode);
    pause.textContent = model.mode === "paused" ? "繼續" : "暫停";
    pause.setAttribute(
      "aria-label",
      model.mode === "paused" ? "繼續遊戲" : "暫停遊戲",
    );
  }
  const record = saves.data.stages[stage01.id];
  const warning = saves.warning
    ? `<p class="notice" role="status">${saves.warning}</p>`
    : "";
  if (model.mode === "menu")
    panel.innerHTML = `<p class="eyebrow">COASTAL STRIKE / 01</p><h2>雲際航線</h2><p class="brief">穿越沿岸防線，擊破重裝指揮艦。</p><p class="brief">鍵盤 C 換武器；觸控按住畫面拖曳連射</p><p>最高分 <strong class="stat">${record?.bestScore ?? 0}</strong></p><p>${record?.cleared ? "已通關" : "尚未通關"} · 通關 ${record?.clearCount ?? 0} 次</p><button id="start">開始飛行</button><details><summary>設定與本機紀錄</summary><p class="help">原創電子配樂與音效，Boss 戰切換專屬主題。音量設為 0 即靜音，設定保存在本機。</p><label>音樂<input id="music" type="range" min="0" max="1" step=".1" value="${saves.data.settings.musicVolume}"></label><label>音效<input id="sfx" type="range" min="0" max="1" step=".1" value="${saves.data.settings.sfxVolume}"></label><button id="reset" class="secondary">重設本機紀錄</button></details>${warning}`;
  else if (model.mode === "playing" || model.mode === "paused")
    panel.innerHTML = `<h2>${model.mode === "paused" ? "暫停中" : "航程進行中"}</h2><p>鍵盤按住 Space／Z，或觸控拖曳移動並連射。留意預告後移位，避免留在鎖定線上。</p><p>補給航道可喘息整備。頭目兩側砲座可分別擊破，減少該側彈幕；核心始終可直接攻擊。<br><b>X／側欄炸彈：衝擊炸彈 ×2</b>，清除敵彈並重創敵機。</p><button id="pause">${model.mode === "paused" ? "繼續" : "暫停"}</button><button id="menu" class="secondary">返回標題</button><p class="help">離開分頁會自動暫停。未完成航程不會寫入結算。</p>${warning}`;
  else
    panel.innerHTML = `<h2>${model.mode === "won" ? "Stage 01 通關" : model.lostReason === "timeout" ? "頭目突圍，任務失敗" : "飛行結束"}</h2><p class="stat">${model.score} 分</p><p>航程 ${model.time.toFixed(1)} / ${stage01.duration} 秒</p><p>最高分 ${record?.bestScore ?? 0} · 通關 ${record?.clearCount ?? 0} 次</p><button id="retry">再飛一次</button><button id="menu" class="secondary">返回標題</button>${warning}`;
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
  background!: CoastalBackground;
  pickupGuide: Phaser.GameObjects.Text[] = [];
  pickupNotice!: Phaser.GameObjects.Text;
  pickupNoticeUntil = 0;
  sectionNotice!: Phaser.GameObjects.Text;
  bossAdvice!: Phaser.GameObjects.Text;
  endingAge = 0;
  lastDrawMode: Mode = "menu";
  bossWarningPlayed = false;
  bank = 0;
  lastPlayerX = 180;
  ambience = 0;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  visuals: Phaser.GameObjects.Image[] = [];
  visualIndex = 0;
  preload() {
    for (const file of [
      "player",
      "scout",
      "heavy",
      "boss",
      "coast",
      "interceptor",
      "carrier",
      "harbor-battlefield",
      "harbor-exit",
      "harbor-refinery",
      "ground-battery",
      "ground-depot",
    ])
      this.load.image(
        file,
        import.meta.env.BASE_URL + "assets/original/" + file + ".png",
      );
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
      image = this.add.image(x, y, key).setDepth(1).setOrigin(0.5);
      this.visuals.push(image);
    }
    if (image.texture.key !== key) image.setTexture(key);
    image
      .setPosition(x, y)
      .setDisplaySize(width, height)
      .setAlpha(alpha)
      .setAngle(angle)
      .setVisible(true)
      .setDepth(1)
      .clearTint();
    return image;
  }
  create() {
    this.background = new CoastalBackground(this);
    readBackgroundInfo = () => this.background.diagnostics();
    createPickupTextures(this);
    this.pickupGuide = ["修復", "升級", "散射", "貫穿", "追蹤", "僚機"].map(
      (text, i) =>
        this.add
          .text(55 + i * 50, 602, text, { fontSize: "10px", color: "#e2eefa" })
          .setOrigin(0.5)
          .setDepth(5),
    );
    this.pickupNotice = this.add
      .text(180, 90, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#fff3c5",
        backgroundColor: "#122c3bdd",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setVisible(false);
    this.sectionNotice = this.add
      .text(180, 116, "", {
        fontSize: "13px",
        color: "#d1f5ef",
        align: "center",
        backgroundColor: "#102935dd",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.bossAdvice = this.add
      .text(180, 600, "", {
        fontSize: "10px",
        color: "#ffc69f",
        align: "center",
        backgroundColor: "#102935dd",
        padding: { x: 5, y: 3 },
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5)
      .setDepth(5);
    graphics = this.add.graphics();
    overlay = this.add.graphics().setDepth(3);
    label = this.add
      .text(16, 14, "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#d7f9ff",
      })
      .setDepth(5);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Z,ENTER,P,X,C,SHIFT",
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
    this.input.keyboard!.on("keydown-C", (event: KeyboardEvent) => {
      if (!event.repeat && model.switchWeapon()) audio.play("power");
    });
    this.input.keyboard!.on("keydown-X", (event: KeyboardEvent) => {
      if (!event.repeat && model.useBomb()) {
        audio.play("bomb");
        this.cameras.main.shake(180, 0.008);
      }
    });
    const canvas = this.game.canvas;
    const clearTouch = () => touch.cancel();
    canvas.addEventListener("pointerdown", (event) => {
      if (
        model.mode !== "playing" ||
        !["touch", "pen"].includes(event.pointerType)
      )
        return;
      const rect = canvas.getBoundingClientRect();
      if (
        touch.begin(
          event.pointerId,
          event.clientX,
          event.clientY,
          model.player.x,
          model.player.y,
          { x: rect.width / stage01.width, y: rect.height / stage01.height },
        )
      ) {
        canvas.setPointerCapture(event.pointerId);
        void audio.unlock();
        event.preventDefault();
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (touch.move(event.pointerId, event.clientX, event.clientY))
        event.preventDefault();
    });
    canvas.addEventListener("pointerup", (event) => touch.end(event.pointerId));
    canvas.addEventListener("pointercancel", (event) =>
      touch.end(event.pointerId),
    );
    canvas.addEventListener("lostpointercapture", (event) =>
      touch.end(event.pointerId),
    );
    window.addEventListener("blur", clearTouch);
    window.addEventListener("resize", () => touch.resize());
    bindTouchAction("touch-bomb", () => {
      void audio.unlock();
      if (model.useBomb()) {
        audio.play("bomb");
        this.cameras.main.shake(180, 0.008);
      }
    });
    bindTouchAction("touch-weapon", () => {
      void audio.unlock();
      if (model.switchWeapon()) audio.play("power");
    });
    bindTouchAction("touch-pause", () => {
      model.pause();
      renderPanel();
    });
    renderPanel();
  }
  update(_time: number, delta: number) {
    if (model.mode !== this.lastDrawMode) {
      this.endingAge = 0;
      this.lastDrawMode = model.mode;
    }
    if (model.mode === "playing" && model.time === 0)
      this.bossWarningPlayed = false;
    if (model.mode === "won") this.endingAge += Math.min(delta / 1000, 0.05);
    panel.style.visibility =
      model.mode === "won" && this.endingAge < 1.2 ? "hidden" : "visible";
    if (
      model.mode === "playing" &&
      model.time >= (stage01.boss?.at ?? Infinity) - 5 &&
      model.time < (stage01.boss?.at ?? Infinity) &&
      !this.bossWarningPlayed
    ) {
      this.bossWarningPlayed = true;
      audio.play("phase");
    }
    const bombButton = document.getElementById(
      "touch-bomb",
    ) as HTMLButtonElement | null;
    if (bombButton) {
      bombButton.textContent = `炸彈 ${model.bombs}`;
      bombButton.disabled = model.mode !== "playing" || model.bombs === 0;
    }
    const weaponButton = document.getElementById("touch-weapon");
    if (weaponButton)
      weaponButton.textContent =
        model.weaponMode === "spread"
          ? "散射"
          : model.weaponMode === "beam"
            ? "貫穿"
            : "追蹤";
    frameCount++;
    frameTime += delta;
    if (model.mode === "playing" || model.mode === "menu")
      this.ambience += Math.min(delta / 1000, 0.05);
    if (model.mode === "playing") this.input.keyboard!.enableGlobalCapture();
    else this.input.keyboard!.disableGlobalCapture();
    const on = (...names: string[]) =>
      names.some((k) => this.keys[k].isDown) ? 1 : 0;
    if (model.mode === "playing" && model.time === 0)
      this.pickupNoticeUntil = 0;
    if (model.mode !== "playing") touch.cancel();
    const touchFrame = touch.sample(model.player, delta / 1000);
    advanceFrame(
      model,
      delta / 1000,
      on("D", "RIGHT") - on("A", "LEFT"),
      on("S", "DOWN") - on("W", "UP"),
      !!on("SPACE", "Z") || touchFrame.fire,
      !!on("SHIFT"),
      touchFrame.target,
    );
    const move = model.player.x - this.lastPlayerX;
    this.bank = Phaser.Math.Linear(
      this.bank,
      Math.max(-12, Math.min(12, move * 8)),
      0.16,
    );
    this.lastPlayerX = model.player.x;
    if (model.shots > previous.shots)
      audio.play(
        model.weaponMode === "missile"
          ? "missile"
          : model.weaponMode === "beam"
            ? "beam"
            : "shot",
      );
    audio.setMusicContext(
      model.boss?.active
        ? "boss"
        : ["recovery", "regroup"].includes(model.section.id)
          ? "recovery"
          : model.enemies.some((e) => e.active && e.behavior === "gatekeeper")
            ? "pressure"
            : "flight",
    );
    audio.setIntensity(
      model.boss?.active ||
        model.enemies.some((e) => e.active && e.behavior === "gatekeeper")
        ? 2
        : ["recovery", "regroup"].includes(model.section.id)
          ? 0
          : model.time > 15
            ? 1
            : 0,
    );
    if (
      model.killCount > previous.kills ||
      model.partsDestroyed > previous.parts
    )
      audio.play("explode");
    if (model.damageCount > previous.hurt) {
      audio.play("hurt");
      this.cameras.main.shake(140, 0.006);
    }
    if (model.pickupCount > previous.pickup) {
      audio.play("power");
      const picked = pickupVisual(model.lastPickup ?? "power");
      this.pickupNotice.setText(
        picked.label +
          (model.lastPickup === "support"
            ? " 8s"
            : model.lastPickup === "heal"
              ? ""
              : ` LV${model.weaponLevel}`),
      );
      this.pickupNoticeUntil = model.time + 1.6;
    }
    this.pickupNotice.setVisible(
      model.mode === "playing" &&
        model.time < this.pickupNoticeUntil &&
        model.time > 0.1,
    );
    if ((model.boss?.phase ?? 0) > previous.phase) audio.play("phase");
    previous.shots = model.shots;
    previous.kills = model.killCount;
    previous.hurt = model.damageCount;
    previous.pickup = model.pickupCount;
    previous.phase = model.boss?.phase ?? 0;
    previous.parts = model.partsDestroyed;
    audio.update(delta / 1000);
    if ((model.mode === "won" || model.mode === "lost") && !recorded) {
      recorded = true;
      saves.record(stage01.id, model.score, model.mode === "won");
    }
    if (model.mode !== lastMode) {
      renderPanel();
      if (model.mode === "won") panel.style.visibility = "hidden";
      if (model.mode === "won" || model.mode === "lost") audio.play(model.mode);
    }
    const drawStarted = performance.now();
    this.draw();
    if (model.mode === "playing")
      renderMetrics.sample(
        model,
        this.visualIndex,
        this.visuals.length,
        performance.now() - drawStarted,
      );
  }
  draw() {
    this.visualIndex = 0;
    const section = model.section;
    const patrol = model.enemies.find(
      (e) => e.active && e.behavior === "gatekeeper",
    );
    this.sectionNotice.setVisible(
      model.mode === "playing" &&
        !model.boss?.active &&
        !patrol &&
        !!section &&
        model.time - section.at < 3.2,
    );
    if (section)
      this.sectionNotice.setText(`${section.title}\n${section.hint}`);
    if (
      model.mode === "playing" &&
      model.time >= (stage01.boss?.at ?? Infinity) - 5 &&
      model.time < (stage01.boss?.at ?? Infinity)
    ) {
      this.sectionNotice
        .setVisible(true)
        .setText(
          `指揮艦接近 · ${Math.ceil((stage01.boss?.at ?? 0) - model.time)}\n保留炸彈，留意兩側砲座`,
        );
    }
    this.bossAdvice.setVisible(
      model.mode === "playing" && (!!model.boss?.active || !!patrol),
    );
    this.bossAdvice.setText(
      patrol
        ? "避開金色預告線 · 移位後追擊巡邏艦"
        : model.boss?.cannons.some((c) => c.active)
          ? "擊破側炮可減少彈幕 · 核心可直接攻擊"
          : "側炮全毀 · 集中攻擊核心",
    );
    this.pickupGuide.forEach((text) => text.setVisible(model.mode === "menu"));

    graphics.clear();
    overlay.clear();
    this.background.update(
      model.mode === "menu"
        ? this.ambience
        : model.time + (model.mode === "won" ? this.endingAge : 0),
    );

    if (model.mode !== "menu") {
      for (const b of model.bullets)
        if (b.active) {
          this.sprite(
            b.kind === "missile" ? "fire03" : "laserBlue01",
            b.x,
            b.y,
            b.kind === "missile"
              ? 10
              : b.kind === "beam"
                ? (b.width ?? 8)
                : model.weaponLevel === 3
                  ? 8
                  : 6,
            b.kind === "missile"
              ? 25
              : b.kind === "beam"
                ? 62
                : model.weaponLevel === 3
                  ? 34
                  : 26,
            1,
            (Math.atan2(b.vx ?? 0, -(b.vy ?? -550)) * 180) / Math.PI,
          ).setTint(
            b.kind === "missile"
              ? 0xffc869
              : b.kind === "beam"
                ? 0x90ffe9
                : model.weaponLevel === 3
                  ? 0xffed9e
                  : 0xffffff,
          );
          if (b.kind === "missile") {
            const length = Math.hypot(b.vx ?? 0, b.vy ?? -330) || 1;
            const dx = (b.vx ?? 0) / length,
              dy = (b.vy ?? -330) / length;
            overlay.lineStyle(4, 0xffb34f, 0.8);
            overlay.lineBetween(b.x - dx * 18, b.y - dy * 18, b.x, b.y);
            overlay.lineStyle(2, 0xfff4cf, 1);
            overlay.lineBetween(
              b.x - dx * 5,
              b.y - dy * 5,
              b.x + dx * 5,
              b.y + dy * 5,
            );
          }
        }
      for (const e of model.enemies)
        if (e.active) {
          const grounded =
            e.behavior === "groundBattery" || e.behavior === "groundDepot";
          graphics.fillStyle(0x04131e, grounded ? 0.35 : 0.22);
          graphics.fillEllipse(
            e.x + (grounded ? 5 : 12),
            e.y + (grounded ? 7 : 22),
            e.behavior === "gatekeeper" ? 96 : grounded ? 48 : 38,
            grounded ? 40 : 20,
          );
          if (e.behavior === "gatekeeper") {
            // A broad patrol corvette has a distinct silhouette and readable lane warning.
            overlay.fillStyle(0x182d3d);
            overlay.fillRoundedRect(e.x - 49, e.y - 28, 98, 58, 8);
            overlay.lineStyle(2, 0xdcb878, 0.95);
            overlay.strokeRoundedRect(e.x - 49, e.y - 28, 98, 58, 8);
            this.sprite("heavy", e.x, e.y, 68, 70).setDepth(4);
            for (const side of [-1, 1]) {
              overlay.fillStyle(0x354f60);
              overlay.fillRect(e.x + side * 39 - 7, e.y - 17, 14, 45);
              overlay.fillStyle(0xffd08a);
              overlay.fillRect(e.x + side * 39 - 3, e.y + 18, 6, 18);
              this.sprite(
                "fire03",
                e.x + side * 31,
                e.y - 35,
                8,
                15,
                0.75,
              ).setDepth(4);
            }
            overlay.fillStyle(0x1c2830);
            overlay.fillRect(e.x - 44, e.y - 39, 88, 4);
            overlay.fillStyle(0xffc775);
            overlay.fillRect(
              e.x - 44,
              e.y - 39,
              88 * Math.max(0, e.hp / (e.maxHp ?? e.hp)),
              4,
            );
            if ((e.telegraph ?? 0) > 0) {
              overlay.lineStyle(
                1.5,
                0xffc66e,
                0.55 + Math.sin(model.time * 16) * 0.18,
              );
              for (const lane of e.attackLanes ?? []) {
                overlay.lineBetween(lane, e.y + 34, lane, 620);
                overlay.strokeTriangle(
                  lane - 5,
                  e.y + 42,
                  lane + 5,
                  e.y + 42,
                  lane,
                  e.y + 51,
                );
              }
              if (e.attackPattern === "aim") {
                const angle = e.aimAngle ?? 0;
                overlay.lineBetween(
                  e.x,
                  e.y + 35,
                  e.x + Math.sin(angle) * 600,
                  e.y + 35 + Math.cos(angle) * 600,
                );
              }
            }
            continue;
          }
          if (e.behavior === "groundBattery" || e.behavior === "groundDepot") {
            this.sprite(
              e.behavior === "groundBattery"
                ? "ground-battery"
                : "ground-depot",
              e.x,
              e.y,
              70,
              e.behavior === "groundBattery" ? 70 : 48,
            ).setDepth(0);
            // Subtle base rim distinguishes interactive targets from painted scenery.
            if (e.y >= GROUND_VISIBLE_Y) {
              overlay.lineStyle(
                1,
                e.behavior === "groundBattery" ? 0xf4ba72 : 0x88e1ca,
                0.7,
              );
              overlay.strokeEllipse(e.x, e.y + 10, 64, 44);
              if (e.hp < (e.maxHp ?? e.hp)) {
                overlay.fillStyle(0x10232a, 0.9);
                overlay.fillRect(e.x - 24, e.y - 39, 48, 3);
                overlay.fillStyle(0xffc775);
                overlay.fillRect(
                  e.x - 24,
                  e.y - 39,
                  48 * Math.max(0, e.hp / (e.maxHp ?? e.hp)),
                  3,
                );
              }
            }
            if ((e.telegraph ?? 0) > 0) {
              const angle = e.aimAngle ?? 0;
              overlay.lineStyle(2, 0xffbc73, 0.9);
              overlay.strokeCircle(
                e.x,
                e.y + 20,
                11 + Math.sin(model.time * 20) * 3,
              );
              // Locked aim, not a tracking laser: the player can step aside.
              overlay.lineStyle(1.5, 0xffbc73, 0.65);
              for (let distance = 32; distance < 360; distance += 28)
                overlay.lineBetween(
                  e.x + Math.sin(angle) * distance,
                  e.y + 20 + Math.cos(angle) * distance,
                  e.x + Math.sin(angle) * (distance + 12),
                  e.y + 20 + Math.cos(angle) * (distance + 12),
                );
            }
            continue;
          }
          if (e.behavior === "escort") {
            this.sprite("scout", e.x, e.y, 47, 40).setDepth(4);
            overlay.fillStyle(0x697b8c);
            overlay.fillTriangle(
              e.x - 35,
              e.y + 15,
              e.x - 17,
              e.y - 15,
              e.x - 13,
              e.y + 20,
            );
            overlay.fillTriangle(
              e.x + 35,
              e.y + 15,
              e.x + 17,
              e.y - 15,
              e.x + 13,
              e.y + 20,
            );
            overlay.lineStyle(2, 0x9ee5dd, 0.9);
            overlay.lineBetween(e.x - 34, e.y + 14, e.x - 19, e.y - 11);
            overlay.lineBetween(e.x + 34, e.y + 14, e.x + 19, e.y - 11);
            for (const side of [-1, 1]) {
              overlay.fillStyle(e.volleyFired ? 0x4d7478 : 0xffd28a);
              overlay.fillCircle(e.x + side * 23, e.y + 11, 3);
            }
            if ((e.telegraph ?? 0) > 0) {
              overlay.lineStyle(1.5, 0xffcc80, 0.7);
              for (const offset of [-0.28, 0, 0.28]) {
                const angle = (e.aimAngle ?? 0) + offset;
                overlay.lineBetween(
                  e.x,
                  e.y + 18,
                  e.x + Math.sin(angle) * 40,
                  e.y + 18 + Math.cos(angle) * 40,
                );
              }
            }
            continue;
          }
          this.sprite(
            e.behavior === "carrier"
              ? "carrier"
              : e.behavior === "dive" || e.behavior === "cross"
                ? "interceptor"
                : e.behavior === "heavy" || e.behavior === "turret"
                  ? "heavy"
                  : "scout",
            e.x,
            e.y,
            e.behavior === "carrier"
              ? 64
              : e.behavior === "heavy"
                ? 70
                : e.behavior === "turret"
                  ? 56
                  : e.behavior === "dive" || e.behavior === "cross"
                    ? 28
                    : 42,
            e.behavior === "carrier"
              ? 56
              : e.behavior === "heavy"
                ? 61
                : e.behavior === "turret"
                  ? 49
                  : e.behavior === "cross" || e.behavior === "dive"
                    ? 42
                    : 36,
            1,
            e.behavior === "carrier"
              ? -(e.direction ?? 1) * 90
              : e.behavior === "cross"
                ? -(e.direction ?? 1) * 72
                : e.behavior === "dive"
                  ? (-(e.diveAngle ?? 0) * 180) / Math.PI
                  : e.behavior === "weave"
                    ? Math.sin((e.age ?? 0) * 2.6) * 18
                    : 0,
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
      // Amber dashed rays are locked attack forecasts, never damaging beams.
      // Rays stop at the playfield edge; the gap is intentionally left clear.
      for (const e of model.enemies) {
        if (!e.active || (e.telegraph ?? 0) <= 0) continue;
        const angles =
          e.behavior === "dive" && e.aimAngle !== undefined
            ? [e.aimAngle]
            : (e.attackAngles ?? []);
        for (const [index, angle] of angles.entries()) {
          overlay.lineStyle(1.3, 0xffd179, 0.55);
          const fast =
            e.behavior === "straight" ||
            e.behavior === "weave" ||
            e.behavior === "cross";
          for (let d = 20; d < (fast ? 120 : 480); d += 24) {
            const muzzle = fast ? (index === 0 ? -9 : 9) : 0;
            const x = e.x + Math.cos(angle) * muzzle + Math.sin(angle) * d;
            const y =
              e.y +
              (e.behavior === "dive" ? 0 : 20) -
              Math.sin(angle) * muzzle +
              Math.cos(angle) * d;
            if (x < 10 || x > 350 || y < 84 || y > 625) break;
            overlay.lineBetween(
              x,
              y,
              x + Math.sin(angle) * 10,
              y + Math.cos(angle) * 10,
            );
          }
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
          const art = pickupVisual(pickup.kind);
          overlay.lineStyle(
            1,
            art.color,
            0.25 + Math.sin(model.time * 4) * 0.1,
          );
          overlay.strokeCircle(pickup.x, pickup.y, 20);
          this.sprite(
            art.key,
            pickup.x,
            pickup.y,
            32,
            32,
            1,
            Math.sin(model.time * 3) * 4,
          ).setDepth(4);
        }
      if (model.boss?.active) {
        this.sprite(
          "boss",
          model.boss.x,
          model.boss.y,
          120,
          81,
          1,
          Math.sin(model.time * 1.8) * 2,
        );
        for (const cannon of model.boss.cannons) {
          overlay.fillStyle(cannon.active ? 0x513745 : 0x16222c);
          overlay.fillRoundedRect(cannon.x - 13, cannon.y - 14, 26, 30, 4);
          overlay.lineStyle(1.5, cannon.active ? 0xffce83 : 0x526676);
          overlay.strokeRoundedRect(cannon.x - 13, cannon.y - 14, 26, 30, 4);
          if (cannon.active) {
            overlay.fillStyle(0xffd98b);
            overlay.fillRect(cannon.x - 3, cannon.y + 4, 6, 18);
            overlay.fillStyle(0x28343e);
            overlay.fillRect(cannon.x - 14, cannon.y - 20, 28, 3);
            overlay.fillStyle(0xffc779);
            overlay.fillRect(
              cannon.x - 14,
              cannon.y - 20,
              (28 * cannon.hp) / cannon.maxHp,
              3,
            );
          } else {
            overlay.lineStyle(2, 0x8a6c60);
            overlay.lineBetween(
              cannon.x - 8,
              cannon.y - 8,
              cannon.x + 8,
              cannon.y + 8,
            );
            overlay.lineBetween(
              cannon.x + 8,
              cannon.y - 8,
              cannon.x - 8,
              cannon.y + 8,
            );
          }
        }
        if (model.boss.attackWarning > 0) {
          for (const [index, angle] of model.boss.attackAngles.entries()) {
            if (index === 0 && !model.boss.cannons[0].active) continue;
            if (
              index === model.boss.attackAngles.length - 1 &&
              !model.boss.cannons[1].active
            )
              continue;
            overlay.lineStyle(1.8, 0xffd179, 0.65);
            for (let d = 40; d < 580; d += 26) {
              const x = model.boss.x + Math.sin(angle) * d;
              const y = model.boss.y + 28 + Math.cos(angle) * d;
              if (x < 10 || x > 350 || y > 625) break;
              overlay.lineBetween(
                x,
                y,
                x + Math.sin(angle) * 13,
                y + Math.cos(angle) * 13,
              );
            }
          }
        }
        // Reactor pulses convey phase escalation without altering collision bounds.
        overlay.fillStyle(model.boss.phase === 3 ? 0xff805a : 0xffbf73, 0.6);
        overlay.fillCircle(
          model.boss.x,
          model.boss.y + 24,
          3 + Math.sin(model.time * 12),
        );
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
      for (const drone of model.supportDrones) {
        this.sprite("player", drone.x, drone.y, 22, 22, 0.95);
        this.sprite("fire03", drone.x, drone.y + 16, 5, 11, 0.85, 180);
        overlay.lineStyle(1, 0x9fffe1, 0.25);
        overlay.lineBetween(
          model.player.x,
          model.player.y + 10,
          drone.x,
          drone.y,
        );
      }
      graphics.fillStyle(0x04131e, 0.25);
      graphics.fillEllipse(model.player.x + 10, model.player.y + 21, 30, 18);
      const p =
        model.mode === "won"
          ? {
              x: model.player.x,
              y: model.player.y - Math.min(this.endingAge, 1.2) * 220,
            }
          : model.player;
      if (model.invincible <= 0 || Math.floor(model.time * 14) % 2 === 0) {
        this.sprite(
          "player",
          p.x + 5,
          p.y + 7,
          44,
          44,
          0.22,
          this.bank,
        ).setTint(0x001321);
        this.sprite("player", p.x, p.y, 44, 44, 1, this.bank);
        this.sprite(
          "fire03",
          p.x,
          p.y + 25,
          9,
          16 + Math.sin(model.time * 45) * 3,
          0.85,
          180,
        );
        if (model.focus) {
          overlay.lineStyle(1, 0xa6ffee, 0.9);
          overlay.strokeCircle(p.x, p.y, 7);
          overlay.fillStyle(0xffffff);
          overlay.fillCircle(p.x, p.y, 2);
        }
        // Collision bounds stay independent of decorative sprite size.
      }
      for (const e of model.effects) {
        const life = e.life - (model.mode === "won" ? this.endingAge : 0);
        if (life <= 0) continue;
        const progress = 1 - life / 0.45;
        overlay.lineStyle(3 * (1 - progress) + 1, 0xffd58a, 1 - progress);
        overlay.strokeCircle(e.x, e.y, 4 + progress * 29);
        overlay.fillStyle(0xfff5cb, Math.max(0, 1 - progress * 2));
        overlay.fillCircle(e.x, e.y, 11 * (1 - progress));
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          overlay.lineStyle(2, i % 2 ? 0xffa54c : 0xffecaa, 1 - progress);
          overlay.lineBetween(
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
      ["heal", "power", "spread", "beam", "missile", "support"].forEach(
        (kind, i) =>
          this.sprite(
            pickupVisual(kind).key,
            55 + i * 50,
            576,
            30,
            30,
          ).setDepth(4),
      );
      this.sprite("player", 180, 82, 80, 80, 0.85, Math.sin(this.ambience) * 3);
      this.sprite("fire03", 180, 127, 10, 20, 0.9, 180);
    }
    if (model.mode !== "menu") {
      overlay.fillStyle(0x0c2133, 0.96);
      overlay.fillRect(0, 0, 360, 72);
    }
    if (model.mode !== "menu") {
      const sections = stage01.sections ?? [];
      sections.forEach((section, i) => {
        const active = model.time >= section.at;
        overlay.fillStyle(active ? 0x8ce5d0 : 0x314b58, active ? 0.9 : 0.55);
        const segment = 328 / Math.max(1, sections.length);
        overlay.fillRect(16 + i * segment, 67, segment - 5, 3);
      });
    }
    label.setText(
      model.mode === "menu"
        ? ""
        : `分數 ${String(model.score).padStart(6, "0")}   生命 ${"♥".repeat(Math.max(0, model.hp))}\n${model.mode === "won" ? "STAGE CLEAR" : model.mode === "lost" ? "MISSION FAILED" : model.boss?.active ? `指揮艦 P${model.boss.phase} · ${Math.ceil(stage01.duration - model.time)}s` : (model.section?.title ?? "STAGE 01")}\n${model.weaponMode === "missile" ? "追蹤" : model.weaponMode === "beam" ? "貫穿" : "散射"} ${model.weaponLevel}/3   炸彈 ${model.bombs}${model.supportTime > 0 ? "  僚機 " + Math.ceil(model.supportTime) + "s" : ""}`,
    );
    if (model.mode === "won" && this.endingAge < 1.2 && model.boss) {
      const t = this.endingAge / 1.2;
      overlay.lineStyle(5 * (1 - t) + 1, 0xffd697, 1 - t);
      overlay.strokeCircle(model.boss.x, model.boss.y, 20 + t * 180);
      overlay.fillStyle(0xffe5a5, Math.max(0, 0.7 - t));
      overlay.fillCircle(model.boss.x, model.boss.y, 18 + t * 35);
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        overlay.lineStyle(2, 0xffac76, 1 - t);
        overlay.lineBetween(
          model.boss.x + Math.cos(a) * t * 60,
          model.boss.y + Math.sin(a) * t * 60,
          model.boss.x + Math.cos(a) * t * 150,
          model.boss.y + Math.sin(a) * t * 150,
        );
      }
    }
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
    // Reused slots stay visible; hide only surplus sprites left by the last frame.
    for (let i = this.visualIndex; i < this.visuals.length; i++) {
      if (this.visuals[i].visible) this.visuals[i].setVisible(false);
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
  render: { pixelArt: false, antialias: true },
  fps: { target: 60 },
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) touch.cancel();
  if (document.hidden && model.mode === "playing") {
    model.pause();
    renderPanel();
  }
});
// Read-only diagnostics used by browser tests; no bypass of damage or stage time.
Object.defineProperty(window, "__P01__", {
  value: () => ({
    mode: model.mode,
    touchTarget: touch.target,
    time: model.time,
    score: model.score,
    hp: model.hp,
    player: { ...model.player },
    bullets: model.bullets.filter((b) => b.active).length,
    projectiles: model.bullets
      .filter((b) => b.active)
      .map((b) => ({
        kind: b.kind,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        targetId: b.targetId,
      })),
    enemies: model.enemies.filter((e) => e.active).length,
    bulletPool: model.bullets.length,
    enemyPool: model.enemies.length,
    activeEnemies: model.enemies
      .filter((e) => e.active)
      .map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        behavior: e.behavior,
        hp: e.hp,
        maxHp: e.maxHp,
        telegraph: e.telegraph,
        attackAngles: e.attackAngles,
        attackPattern: e.attackPattern,
        attackLanes: e.attackLanes,
        volleyFired: e.volleyFired,
        visibleSince: e.visibleSince,
        shotsFired: e.shotsFired,
      })),
    spawnedAir: model.spawnedAir,
    enteredAir: model.enteredAir,
    shots: model.shots,
    groundShotCount: model.groundShotCount,
    enemyBullets: model.enemyBullets.filter((b) => b.active).length,
    pickups: model.pickups.filter((p) => p.active).length,
    activePickups: model.pickups
      .filter((p) => p.active)
      .map((p) => ({ kind: p.kind, x: p.x, y: p.y })),
    lastPickup: model.lastPickup,
    supportTime: model.supportTime,
    supportShots: model.supportShots,
    supportDrones: model.supportDrones,
    boss: model.boss ? { ...model.boss } : null,
    bossDefeated: model.bossDefeated,
    section: model.section,
    partsDestroyed: model.partsDestroyed,
    weaponTime: model.weaponTime,
    weaponLevel: model.weaponLevel,
    weaponMode: model.weaponMode,
    focus: model.focus,
    bombs: model.bombs,
    audio: audio.diagnostics(),
    lostReason: model.lostReason,
    save: saves.data,
    background: readBackgroundInfo(),
    renderMetrics: renderMetrics.snapshot(),
    measuredFps: frameTime > 0 ? (frameCount * 1000) / frameTime : 0,
  }),
});
