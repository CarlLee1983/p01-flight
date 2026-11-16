import Phaser from "phaser";
import { stage01 } from "./data/stage";
import { FlightModel, type Mode } from "./game/model";
import { BrowserSaveRepository } from "./storage/save";
import { FlightAudio } from "./game/audio";
import { CoastalBackground } from "./game/background";
import { createPickupTextures, pickupVisual } from "./game/pickup-art";
import { createGroundTextures } from "./game/ground-art";
import "./style.css";
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {}
const saves = new BrowserSaveRepository(storage);
const model = new FlightModel(stage01);
const audio = new FlightAudio();
let previous = { shots: 0, kills: 0, hurt: 0, pickup: 0, phase: 0, parts: 0 };
const panel = document.querySelector<HTMLElement>("#panel")!;
let lastMode: Mode | null = null;
let recorded = false;
let graphics: Phaser.GameObjects.Graphics;
let label: Phaser.GameObjects.Text;
let overlay: Phaser.GameObjects.Graphics;
let backgroundInfo: Record<string, unknown> = {};
let frameCount = 0,
  frameTime = 0;
function start() {
  void audio.unlock();
  previous = { shots: 0, kills: 0, hurt: 0, pickup: 0, phase: 0, parts: 0 };
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
    panel.innerHTML = `<p class="eyebrow">COASTAL STRIKE / 01</p><h2>雲際航線</h2><p class="brief">穿越沿岸防線，擊破重裝指揮艦。</p><p class="brief">C 切換散射／貫穿／追蹤 · Shift 精準移動</p><p>最高分 <strong class="stat">${record?.bestScore ?? 0}</strong></p><p>${record?.cleared ? "已通關" : "尚未通關"} · 通關 ${record?.clearCount ?? 0} 次</p><button id="start">開始飛行</button><details><summary>設定與本機紀錄</summary><p class="help">原創電子節奏與音效。音量設為 0 即靜音，設定保存在本機。</p><label>音樂<input id="music" type="range" min="0" max="1" step=".1" value="${saves.data.settings.musicVolume}"></label><label>音效<input id="sfx" type="range" min="0" max="1" step=".1" value="${saves.data.settings.sfxVolume}"></label><button id="reset" class="secondary">重設本機紀錄</button></details>${warning}`;
  else if (model.mode === "playing" || model.mode === "paused")
    panel.innerHTML = `<h2>${model.mode === "paused" ? "暫停中" : "航程進行中"}</h2><p>按住 Space／Z 射擊。留意編隊進場與蓄力光圈，側移躲開瞄準彈。</p><p>補給航道可喘息整備。頭目兩側砲座可分別擊破，減少該側彈幕；核心始終可直接攻擊。<br><b>X：衝擊炸彈 ×2</b>，清除敵彈並重創敵機。</p><button id="pause">${model.mode === "paused" ? "繼續" : "暫停"}</button><button id="menu" class="secondary">返回標題</button><p class="help">離開分頁會自動暫停。未完成航程不會寫入結算。</p>${warning}`;
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
      .setDepth(1)
      .clearTint();
    return image;
  }
  create() {
    this.background = new CoastalBackground(this);
    createPickupTextures(this);
    createGroundTextures(this);
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
    renderPanel();
  }
  update(_time: number, delta: number) {
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
    model.update(
      delta / 1000,
      on("D", "RIGHT") - on("A", "LEFT"),
      on("S", "DOWN") - on("W", "UP"),
      !!on("SPACE", "Z"),
      !!on("SHIFT"),
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
    audio.setIntensity(model.boss?.active ? 2 : model.time > 30 ? 1 : 0);
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
    previous = {
      shots: model.shots,
      kills: model.killCount,
      hurt: model.damageCount,
      pickup: model.pickupCount,
      phase: model.boss?.phase ?? 0,
      parts: model.partsDestroyed,
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
    this.visualIndex = 0;
    const section = model.section;
    this.sectionNotice.setVisible(
      model.mode === "playing" &&
        !model.boss?.active &&
        !!section &&
        model.time - section.at < 3.2,
    );
    if (section)
      this.sectionNotice.setText(`${section.title}\n${section.hint}`);
    this.bossAdvice.setVisible(
      model.mode === "playing" && !!model.boss?.active,
    );
    this.bossAdvice.setText(
      model.boss?.cannons.some((c) => c.active)
        ? "擊破側炮可減少彈幕 · 核心可直接攻擊"
        : "側炮全毀 · 集中攻擊核心",
    );
    this.pickupGuide.forEach((text) => text.setVisible(model.mode === "menu"));
    for (const image of this.visuals) image.setVisible(false);
    graphics.clear();
    overlay.clear();
    this.background.update(model.mode === "menu" ? this.ambience : model.time);
    backgroundInfo = this.background.diagnostics();
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
          if (e.behavior === "groundBattery" || e.behavior === "groundDepot") {
            this.sprite(e.behavior, e.x, e.y, 52, 52).setDepth(0);
            if ((e.telegraph ?? 0) > 0) {
              overlay.lineStyle(2, 0xffbc73, 0.9);
              overlay.strokeCircle(
                e.x,
                e.y + 16,
                10 + Math.sin(model.time * 20) * 3,
              );
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
      const p = model.player;
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
        const progress = 1 - e.life / 0.45;
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
    label.setText(
      model.mode === "menu"
        ? ""
        : `SCORE ${String(model.score).padStart(6, "0")}    LIFE ${"♥".repeat(Math.max(0, model.hp))}\n${model.mode === "won" ? "STAGE CLEAR" : model.mode === "lost" ? "MISSION FAILED" : model.boss?.active ? "BOSS P" + model.boss.phase : model.time > 65 ? "BOSS INCOMING" : (model.section?.title ?? "STAGE 01")}   ${Math.ceil(stage01.duration - model.time)}s\n${model.weaponMode === "missile" ? "HOMING" : model.weaponMode === "beam" ? "PIERCE" : "SPREAD"} ${model.weaponLevel}/3    BOMB ${model.bombs}${model.supportTime > 0 ? "  W:" + Math.ceil(model.supportTime) : " [X]"}`,
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
  render: { pixelArt: false, antialias: true },
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
      })),
    shots: model.shots,
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
    background: backgroundInfo,
    measuredFps: frameTime > 0 ? (frameCount * 1000) / frameTime : 0,
  }),
});
