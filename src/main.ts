import {
  ROCKET_ART,
  createRocketPose,
  rocketPresentation,
  drawRocketExhaust,
} from "./game/hostile-rocket";
import { drawBoss } from "./game/boss-presentation";
import { bossRig, bossCoreState, bossArmourRemaining } from "./game/boss-rigs";
import { keyboardEdge } from "./game/keyboard-event";
import { NEXT_ASSETS, nextAssetStatus } from "./game/next-assets";
import { isGroundRole, isNewAirRole, NEW_ENEMY_ART } from "./game/enemy-roles";
import { bossVisual } from "./game/boss-visual";
import { STAGE_CATALOG, stageDetails, stageConfig } from "./game/stage-catalog";
import {
  METAL_SPRITES,
  METAL_EXHAUST,
  readMetalSpriteStatus,
} from "./game/metal-sprites";
import { enemyMount, enemyBank } from "./game/enemy-mounts";
import {
  configureTextureBatch,
  textureBatchName,
} from "./game/texture-batching";
import { createEnemyModuleTextures } from "./game/enemy-modules-art";
import { drawImpact } from "./game/impact-art";
import {
  createPickupLabelTextures,
  pickupLabel,
  pickupMessage,
} from "./game/pickup-labels";
import { raiderMuzzle } from "./game/raider-geometry";
import { createRaiderTextures, RAIDER_ART } from "./game/raider-art";
import { createCannonTextures } from "./game/cannon-art";
import {
  shouldFlashBody,
  bossChargeSources,
  PRESENTATION_LAYERS,
} from "./game/combat-presentation";
import { groundMuzzle } from "./game/hostile-visuals";
import Phaser from "phaser";
import {
  stageUnlocked,
  nextStage,
  newStageSeed,
  type StageId,
} from "./game/stage-selection";
import { CanyonBackground } from "./game/canyon-background";
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
let selectedStage: StageId = "stage-01";
const seedText = new URLSearchParams(location.search).get("seed");
const pinnedSeed =
  seedText !== null &&
  /^\d{1,10}$/.test(seedText) &&
  Number(seedText) <= 0xffffffff
    ? Number(seedText)
    : null;
let stageSeed = pinnedSeed ?? newStageSeed();
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
let impacts: Phaser.GameObjects.Graphics;
let renderedImpactPrimitives = 0;
let renderedHostileMissiles = 0;

let hud: Phaser.GameObjects.Graphics;
let readCombatLayer = () => 0;
let readPickupNotice = (): string | null => null;
let readPickupBounds = (): { x: number; y: number; bottom: number } | null =>
  null;
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
function start(fresh = false) {
  if (!stageUnlocked(selectedStage, saves.data)) return;
  if (fresh) stageSeed = pinnedSeed ?? newStageSeed();
  model.stage = stageConfig(selectedStage, stageSeed);
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
  const stageNumber = stageDetails(selectedStage).number;
  document.querySelector(".masthead h1")!.textContent = model.stage.title;
  document.querySelector(".masthead span")!.textContent =
    `STAGE ${stageNumber}`;
  document
    .querySelector("#game")!
    .setAttribute("aria-label", `${model.stage.title}遊戲畫面`);
  document.title = `${model.stage.title} · COASTLINE ASSAULT`;
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
  const record = saves.data.stages[model.stage.id];
  const seedLabel =
    selectedStage !== "stage-01"
      ? `<p class="help">編隊代碼 ${stageSeed} · 再飛一次保留相同編隊</p>`
      : "";
  const warning = saves.warning
    ? `<p class="notice" role="status">${saves.warning}</p>`
    : "";
  if (model.mode === "menu")
    panel.innerHTML = `<p class="eyebrow">COASTAL STRIKE / ${stageNumber}</p><h2>${stageDetails(selectedStage).title}</h2><p class="brief">${stageDetails(selectedStage).brief}</p><p class="brief">鍵盤 C 換武器；觸控按住畫面拖曳連射</p><p>最高分 <strong class="stat">${record?.bestScore ?? 0}</strong></p><p>${record?.cleared ? "已通關" : "尚未通關"} · 通關 ${record?.clearCount ?? 0} 次</p><label>選擇關卡<select id="stage-select">${STAGE_CATALOG.map((stage) => `<option value="${stage.id}" ${selectedStage === stage.id ? "selected" : ""} ${stageUnlocked(stage.id, saves.data) ? "" : "disabled"}>Stage ${stage.number} ${stage.title}${stageUnlocked(stage.id, saves.data) ? "" : "（前關通關後解鎖）"}</option>`).join("")}</select></label><button id="start">開始飛行</button><details><summary>設定與本機紀錄</summary><p class="help">授權街機配樂與原創音效，Boss 戰切換戰鬥曲。音量設為 0 即靜音，設定保存在本機。</p><label>音樂<input id="music" type="range" min="0" max="1" step=".1" value="${saves.data.settings.musicVolume}"></label><label>音效<input id="sfx" type="range" min="0" max="1" step=".1" value="${saves.data.settings.sfxVolume}"></label><button id="reset" class="secondary">重設本機紀錄</button></details>${warning}`;
  else if (model.mode === "playing" || model.mode === "paused")
    panel.innerHTML = `<h2>${model.mode === "paused" ? "暫停中" : "航程進行中"}</h2><p>鍵盤按住 Space／Z，或觸控拖曳移動並連射。留意敵機炮口充能後移位，避開飛行中的敵彈。</p><p>補給航道可喘息整備。頭目武器可分別擊破：指揮艦翼炮、河艦甲板炮、雷眼護甲環。留意充能後移位，河艦艦尾艦橋是弱點；雷眼須先破護甲，再趁核心開放反擊。<br><b>X／側欄炸彈：衝擊炸彈 ×2</b>，清除敵彈並重創敵機。</p><button id="pause">${model.mode === "paused" ? "繼續" : "暫停"}</button><button id="menu" class="secondary">返回標題</button><p class="help">離開分頁會自動暫停。未完成航程不會寫入結算。</p>${warning}`;
  else
    panel.innerHTML = `<h2>${model.mode === "won" ? `Stage ${stageNumber} 通關` : model.lostReason === "timeout" ? "頭目突圍，任務失敗" : "飛行結束"}</h2><p class="stat">${model.score} 分</p><p>航程 ${model.time.toFixed(1)} / ${model.stage.duration} 秒</p><p>最高分 ${record?.bestScore ?? 0} · 通關 ${record?.clearCount ?? 0} 次</p>${model.mode === "won" && nextStage(selectedStage) ? `<button id="next-stage">前往 Stage ${stageDetails(nextStage(selectedStage)!).number}</button>` : ""}<button id="retry">再飛一次</button>${selectedStage !== "stage-01" ? '<button id="new-sortie" class="secondary">重新編隊出擊</button>' : ""}<button id="menu" class="secondary">返回標題</button>${warning}`;
  document
    .querySelector("#stage-select")
    ?.addEventListener("change", (event) => {
      const id = (event.target as HTMLSelectElement).value as StageId;
      if (!stageUnlocked(id, saves.data)) return;
      selectedStage = id;
      model.stage = stageConfig(id, stageSeed);
      renderPanel();
    });
  document.querySelector("#next-stage")?.addEventListener("click", () => {
    const next = nextStage(selectedStage);
    if (!next) return;
    selectedStage = next;
    start(true);
  });
  document.querySelector("#new-sortie")?.addEventListener("click", () => {
    stageSeed = newStageSeed();
    start();
  });
  document
    .querySelector("#start")
    ?.addEventListener("click", () => start(true));
  document.querySelector("#retry")?.addEventListener("click", () => start());
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
      selectedStage = "stage-01";
      model.stage = stage01;
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
  if (seedLabel) panel.insertAdjacentHTML("beforeend", seedLabel);
  audio.setVolumes(
    saves.data.settings.musicVolume,
    saves.data.settings.sfxVolume,
  );
  audio.setPlaying(model.mode === "playing");
  lastMode = model.mode;
}
class FlightScene extends Phaser.Scene {
  background!: CoastalBackground;
  canyon!: CanyonBackground;
  polar?: CanyonBackground;
  coastalObjects: Phaser.GameObjects.GameObject[] = [];
  pickupGuide: Phaser.GameObjects.Text[] = [];
  pickupNotice!: Phaser.GameObjects.Text;
  pickupNoticeUntil = 0;
  private pickupInHud = false;
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
    for (const key of NEXT_ASSETS)
      this.load.image(
        key,
        import.meta.env.BASE_URL + "assets/original/" + key + ".webp",
      );
    for (const sprite of METAL_SPRITES)
      this.load.image(sprite.key, import.meta.env.BASE_URL + sprite.path);
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
      "ground-base",
      "ground-turret",
      "ground-depot",
    ])
      this.load.image(
        file,
        import.meta.env.BASE_URL + "assets/original/" + file + ".png",
      );
    for (const kind of ["river", "bridge", "mine", "dam", "reservoir"])
      this.load.image(
        "canyon-" + kind,
        import.meta.env.BASE_URL + "assets/original/canyon-" + kind + ".webp",
      );
    this.load.image(
      "river-supply-barge",
      import.meta.env.BASE_URL + "assets/original/river-supply-barge.webp",
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
  private rocketPose = createRocketPose();
  private presentedHits = new WeakMap<object, number>();
  sprite(
    key: string,
    x: number,
    y: number,
    width: number,
    height: number,
    alpha = 1,
    angle = 0,
    damageBody?: { hitUntil?: number },
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
      .clearTint()
      .setTintMode(Phaser.TintModes.MULTIPLY);
    if (damageBody) {
      const hit = damageBody.hitUntil ?? 0;
      const flash = shouldFlashBody(
        hit,
        this.presentedHits.get(damageBody),
        model.time,
      );
      this.presentedHits.set(damageBody, hit);
      if (flash) image.setTint(0x70513a).setTintMode(Phaser.TintModes.ADD);
    }
    return image;
  }
  create() {
    // Texture-only isolation retains the observed missing-quad mitigation.
    // Global batchSize:1 also split every Graphics triangle into a draw call.
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, configureTextureBatch);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(
        Phaser.Scenes.Events.ADDED_TO_SCENE,
        configureTextureBatch,
      );
    });
    const beforeBackground = new Set(this.children.list);
    this.background = new CoastalBackground(this);
    this.coastalObjects = this.children.list.filter(
      (item) => !beforeBackground.has(item),
    );
    this.canyon = new CanyonBackground(this);
    readBackgroundInfo = () =>
      selectedStage === "stage-01"
        ? this.background.diagnostics()
        : selectedStage === "stage-02"
          ? this.canyon.diagnostics()
          : (this.polar?.diagnostics() ?? { theme: "polar", artReady: false });
    readCombatLayer = () =>
      Math.max(
        3,
        ...this.visuals
          .filter((image) => image.visible)
          .map((image) => image.depth),
      );
    createPickupTextures(this);
    createPickupLabelTextures(this);
    createCannonTextures(this);
    createEnemyModuleTextures(this);
    createRaiderTextures(this);
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
    readPickupNotice = () =>
      this.pickupNotice.visible ? this.pickupNotice.text : null;
    readPickupBounds = () => {
      if (!this.pickupNotice.visible) return null;
      const b = this.pickupNotice.getBounds();
      return { x: b.x, y: b.y, bottom: b.bottom };
    };
    this.bossAdvice = this.add
      .text(180, 600, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffc69f",
        align: "center",
        backgroundColor: "#102935dd",
        padding: { x: 5, y: 3 },
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5)
      .setDepth(5);
    graphics = this.add.graphics();
    impacts = this.add.graphics().setDepth(2.7);
    overlay = this.add.graphics().setDepth(PRESENTATION_LAYERS.projectiles);
    hud = this.add.graphics().setDepth(PRESENTATION_LAYERS.hud);
    label = this.add
      .text(16, 14, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#d7f9ff",
      })
      .setLineSpacing(-2)
      .setDepth(5);
    this.keys = this.input.keyboard!.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Z,ENTER,P,X,C,SHIFT",
    ) as typeof this.keys;
    this.input.keyboard!.disableGlobalCapture();
    // Handle edge-triggered actions on keydown so a press released between
    // render frames is not lost. Ignore OS key-repeat to avoid pause toggles.
    this.input.keyboard!.on(
      "keydown-P",
      keyboardEdge<KeyboardEvent>(() => {
        model.pause();
        renderPanel();
      }),
    );
    this.input.keyboard!.on(
      "keydown-ENTER",
      keyboardEdge<KeyboardEvent>(() => {
        if (["menu", "won", "lost"].includes(model.mode)) start();
      }),
    );
    this.input.keyboard!.on(
      "keydown-C",
      keyboardEdge<KeyboardEvent>(() => {
        if (model.switchWeapon()) audio.play("power");
      }),
    );
    this.input.keyboard!.on(
      "keydown-X",
      keyboardEdge<KeyboardEvent>(() => {
        if (model.useBomb()) {
          audio.play("bomb");
          this.cameras.main.shake(180, 0.008);
        }
      }),
    );
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
          {
            x: rect.width / model.stage.width,
            y: rect.height / model.stage.height,
          },
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
      !this.pickupNotice.visible &&
      model.time >= (model.stage.boss?.at ?? Infinity) - 5 &&
      model.time < (model.stage.boss?.at ?? Infinity) &&
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
        : ["recovery", "regroup", "rest", "supply"].includes(model.section.id)
          ? "recovery"
          : model.enemies.some((e) => e.active && e.behavior === "gatekeeper")
            ? "pressure"
            : "flight",
    );
    audio.setIntensity(
      model.boss?.active ||
        model.enemies.some((e) => e.active && e.behavior === "gatekeeper")
        ? 2
        : ["recovery", "regroup", "rest", "supply"].includes(model.section.id)
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
      this.pickupNotice.setText(
        pickupMessage(model.lastPickup ?? "power", model.weaponLevel, model.hp),
      );
      this.pickupNoticeUntil = model.time + 1.6;
    }
    const pickupInHud = !!model.boss?.active;
    if (pickupInHud !== this.pickupInHud) {
      this.pickupInHud = pickupInHud;
      this.pickupNotice
        .setPosition(pickupInHud ? 350 : 180, pickupInHud ? 32 : 90)
        .setOrigin(pickupInHud ? 1 : 0.5, 0.5)
        .setFontSize(pickupInHud ? 11 : 13)
        .setPadding(pickupInHud ? 5 : 8, pickupInHud ? 3 : 5);
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
      saves.record(model.stage.id, model.score, model.mode === "won");
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
        renderedImpactPrimitives,
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
        !this.pickupNotice.visible &&
        !!section &&
        model.time - section.at < 3.2,
    );
    if (section)
      this.sectionNotice.setText(`${section.title}\n${section.hint}`);
    if (
      model.mode === "playing" &&
      !this.pickupNotice.visible &&
      model.time >= (model.stage.boss?.at ?? Infinity) - 5 &&
      model.time < (model.stage.boss?.at ?? Infinity)
    ) {
      this.sectionNotice
        .setVisible(true)
        .setText(
          `${stageDetails(selectedStage).boss}接近 · ${Math.ceil((model.stage.boss?.at ?? 0) - model.time)}\n保留炸彈，留意${bossRig(model.stage.boss?.skin).partLabel}`,
        );
    }
    this.bossAdvice.setVisible(
      model.mode === "playing" && (!!model.boss?.active || !!patrol),
    );
    this.bossAdvice.setText(
      patrol
        ? "留意炮口充能 · 移位後追擊巡邏艦"
        : model.boss?.skin === "polarRadar" &&
            bossCoreState(model.boss) !== "open"
          ? bossCoreState(model.boss) === "armored"
            ? `核心防護中 · 本階段再擊破${bossArmourRemaining(model.boss)}片護甲`
            : "核心換位封閉 · 留意護甲充能"
          : model.boss?.cannons.some((c) => c.active)
            ? `擊破${bossRig(model.boss?.skin).partLabel}可減少彈幕 · ${model.boss?.skin === "riverFortress" ? "艦尾艦橋是弱點" : "核心可直接攻擊"}`
            : model.boss?.skin === "riverFortress"
              ? "甲板炮已毀 · 避開船首火力，攻擊艦橋"
              : `${bossRig(model.boss?.skin).partLabel}已毀 · 集中攻擊核心`,
    );
    this.pickupGuide.forEach((text) => text.setVisible(model.mode === "menu"));

    graphics.clear();
    overlay.clear();
    impacts.clear();
    renderedImpactPrimitives = 0;
    renderedHostileMissiles = 0;
    hud.clear();
    for (const item of this.coastalObjects) {
      if ("setVisible" in item)
        (item as Phaser.GameObjects.Image).setVisible(
          selectedStage === "stage-01",
        );
    }
    this.canyon.update(model.time, selectedStage === "stage-02");
    if (selectedStage === "stage-03" && !this.polar)
      this.polar = new CanyonBackground(this, "polar");
    this.polar?.update(model.time, selectedStage === "stage-03");
    if (selectedStage === "stage-01")
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
          const grounded = isGroundRole(e.behavior);
          graphics.fillStyle(0x04131e, grounded ? 0.35 : 0.22);
          graphics.fillEllipse(
            e.x + (grounded ? 5 : 12),
            e.y + (grounded ? 7 : 22),
            e.behavior === "gatekeeper" ? 96 : grounded ? 48 : 38,
            grounded ? 40 : 20,
          );
          if (isNewAirRole(e.behavior)) {
            const art = NEW_ENEMY_ART[e.behavior];
            this.sprite(art.key, e.x, e.y, art.width, art.height, 1, 0, e);
            if ((e.telegraph ?? 0) > 0) {
              const socket = enemyMount(e);
              overlay.fillStyle(0xffd18b, 0.8);
              overlay.fillCircle(socket.x, socket.y, 3);
            }
            continue;
          }
          if (e.behavior === "gatekeeper") {
            this.sprite("enemy-patrol", e.x, e.y, 104, 76, 1, 0, e).setDepth(
              1.5,
            );
            for (const side of [-1, 1])
              this.sprite(
                "fire03",
                e.x + side * METAL_EXHAUST.gatekeeper.x,
                e.y + METAL_EXHAUST.gatekeeper.y,
                8,
                15,
                0.75,
              ).setDepth(1.7);
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
              // Local weapon charging only: no prediction of the future bullet path.
              overlay.fillStyle(
                0xffc66e,
                0.65 + Math.sin(model.time * 16) * 0.2,
              );
              for (const side of [-1, 1])
                overlay.fillCircle(e.x + side * 39, e.y + 32, 4);
            }
            continue;
          }
          if (isGroundRole(e.behavior)) {
            if (e.behavior === "groundDepot") {
              if (selectedStage === "stage-03" && e.groundSurface !== "water")
                this.sprite(
                  "missile-truck-base",
                  e.x,
                  e.y,
                  72,
                  72,
                  1,
                  0,
                  e,
                ).setDepth(0);
              else
                this.sprite(
                  selectedStage !== "stage-01"
                    ? "river-supply-barge"
                    : "ground-depot",
                  e.x,
                  e.y,
                  70,
                  48,
                  1,
                  0,
                  e,
                ).setDepth(0);
            } else {
              this.sprite(
                e.behavior === "missileTruck"
                  ? "missile-truck-base"
                  : "ground-base",
                e.x,
                e.y,
                72,
                72,
              ).setDepth(0);
              // Texture is down-facing; Phaser clockwise rotation is opposite our aim-from-down axis.
              this.sprite(
                e.behavior === "missileTruck"
                  ? "missile-truck-head"
                  : e.behavior === "flakBattery"
                    ? "flak-head"
                    : "ground-turret",
                e.x,
                e.y,
                48,
                48,
                1,
                (-(e.turretAngle ?? 0) * 180) / Math.PI,
                e,
              ).setDepth(1);
            }
            // Only damaged targets receive a compact health bar; no floating selection rim.
            if (e.y >= GROUND_VISIBLE_Y) {
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
              const muzzle = groundMuzzle(e, angle);
              overlay.fillStyle(0xffbc73, 0.55);
              overlay.fillCircle(muzzle.x, muzzle.y, 5);
              overlay.fillStyle(0xfff2d1, 0.9);
              overlay.fillCircle(muzzle.x, muzzle.y, 2);
            }
            continue;
          }
          if (e.behavior === "escort") {
            this.sprite("enemy-escort", e.x, e.y, 70, 44, 1, 0, e).setDepth(
              1.5,
            );
            if ((e.telegraph ?? 0) > 0) {
              overlay.fillStyle(0xffcc80, 0.8);
              const socket = enemyMount(e);
              overlay.fillCircle(socket.x, socket.y, 4);
            }
            continue;
          }
          if (e.behavior === "brakeRaider" || e.behavior === "hookWing") {
            const art = RAIDER_ART[e.behavior];
            this.sprite(art.key, e.x, e.y, art.width, art.height, 1, 0, e);
            for (const side of [-1, 1]) {
              this.sprite(
                "fire03",
                e.x + side * METAL_EXHAUST[e.behavior].x,
                e.y + METAL_EXHAUST[e.behavior].y,
                4,
                e.behavior === "brakeRaider" ? 8 : 12,
                0.75,
              ).setDepth(1);
              if ((e.telegraph ?? 0) > 0) {
                overlay.fillStyle(
                  0xffce84,
                  0.75 + Math.sin(model.time * 20) * 0.2,
                );
                const muzzle = raiderMuzzle(e, side === -1 ? 0 : 1);
                overlay.fillCircle(muzzle.x, muzzle.y, 3);
              }
            }
            continue;
          }
          this.sprite(
            e.behavior === "turret"
              ? "enemy-gunship"
              : e.behavior === "carrier"
                ? "carrier"
                : e.behavior === "dive" || e.behavior === "cross"
                  ? "interceptor"
                  : e.behavior === "heavy"
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
                  : e.behavior === "cross"
                    ? 32
                    : e.behavior === "dive"
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
            enemyBank(e),
            e,
          ).setTint(e.behavior === "weave" ? 0xffd18c : 0xffffff);
          if (
            this.visuals[this.visualIndex - 1].tintMode === Phaser.TintModes.ADD
          )
            this.visuals[this.visualIndex - 1]
              .setTint(0x70513a)
              .setTintMode(Phaser.TintModes.ADD);
          if ((e.telegraph ?? 0) > 0) {
            for (
              let i = 0;
              i <
              (e.behavior === "turret" ||
              e.behavior === "dive" ||
              e.behavior === "heavy"
                ? 1
                : 2);
              i++
            ) {
              const socket = enemyMount(e, i);
              overlay.fillStyle(0xffbd69, 0.5);
              overlay.fillEllipse(socket.x, socket.y, 7, 10);
              overlay.fillStyle(0xfff2d1, 0.9);
              overlay.fillCircle(socket.x, socket.y, 2);
            }
          }
        }
      // Enemy attacks retain their charge timing, but never draw trajectory guides.
      for (const shot of model.enemyBullets)
        if (shot.active) {
          const speed = Math.hypot(shot.vx, shot.vy) || 1;
          const dx = shot.vx / speed,
            dy = shot.vy / speed;
          const style = shot.visual ?? "needle";
          const color =
            style === "rocket"
              ? 0xffb66f
              : style === "plasma"
                ? 0xd78dff
                : style === "shell"
                  ? 0xffbc69
                  : 0xff6d91;
          if (style !== "rocket") {
            // Short, bounded afterimage; collision remains the existing model radius.
            overlay.lineStyle(3, color, 0.32);
            overlay.lineBetween(
              shot.x - dx * 10,
              shot.y - dy * 10,
              shot.x,
              shot.y,
            );
          }
          overlay.fillStyle(color);
          overlay.lineStyle(1.5, 0xfff2e2);
          if (style === "rocket") {
            const pose = rocketPresentation(shot, model.time, this.rocketPose);
            // A pooled silhouette gives the ivory hull a dark edge over snow,
            // water and player fire. One bounded quad, no particle history.
            this.sprite(
              ROCKET_ART.key,
              shot.x,
              shot.y,
              ROCKET_ART.width + 2,
              ROCKET_ART.height + 2,
              1,
              pose.angle,
            )
              .setTint(0x101521)
              .setDepth(PRESENTATION_LAYERS.projectiles + 0.005);
            this.sprite(
              ROCKET_ART.key,
              shot.x,
              shot.y,
              ROCKET_ART.width,
              ROCKET_ART.height,
              1,
              pose.angle,
            ).setDepth(PRESENTATION_LAYERS.projectiles + 0.01);
            drawRocketExhaust(overlay, pose);
            renderedHostileMissiles++;
          } else if (style === "needle") {
            overlay.fillTriangle(
              shot.x + dx * 6,
              shot.y + dy * 6,
              shot.x - dx * 4 + dy * 3,
              shot.y - dy * 4 - dx * 3,
              shot.x - dx * 4 - dy * 3,
              shot.y - dy * 4 + dx * 3,
            );
            overlay.lineStyle(2, 0xfff2e2);
            overlay.lineBetween(
              shot.x - dx * 2,
              shot.y - dy * 2,
              shot.x + dx * 3,
              shot.y + dy * 3,
            );
          } else {
            overlay.fillCircle(shot.x, shot.y, style === "plasma" ? 5 : 4);
            overlay.strokeCircle(shot.x, shot.y, style === "plasma" ? 5 : 4);
            if (style === "plasma") {
              overlay.lineStyle(1, color, 0.6);
              overlay.strokeCircle(
                shot.x,
                shot.y,
                7 + Math.sin(model.time * 18 + shot.id) * 0.5,
              );
            } else {
              overlay.fillStyle(0xffffff);
              overlay.fillCircle(shot.x, shot.y, 1.5);
            }
          }
          const age = model.time - (shot.bornAt ?? -1);
          if (
            age >= 0 &&
            age < 0.09 &&
            shot.muzzleX !== undefined &&
            shot.muzzleY !== undefined
          ) {
            overlay.lineStyle(2, color, 1 - age / 0.09);
            overlay.lineBetween(
              shot.muzzleX - dy * 5,
              shot.muzzleY + dx * 5,
              shot.muzzleX + dy * 5,
              shot.muzzleY - dx * 5,
            );
            overlay.fillStyle(0xffefc5, 1 - age / 0.09);
            overlay.fillCircle(shot.muzzleX, shot.muzzleY, 3);
          }
        }
      for (const pickup of model.pickups)
        if (pickup.active) {
          const art = pickupVisual(pickup.kind);
          graphics.fillStyle(0x04131e, 0.3);
          graphics.fillEllipse(pickup.x + 4, pickup.y + 7, 28, 13);
          overlay.fillStyle(art.color, 0.55 + Math.sin(model.time * 4) * 0.2);
          for (const side of [-1, 1]) {
            overlay.fillRect(pickup.x + side * 19 - 1, pickup.y - 2, 2, 4);
          }
          this.sprite(
            art.key,
            pickup.x,
            pickup.y,
            32,
            32,
            1,
            Math.sin(model.time * 3) * 4,
          ).setDepth(2);
          if (pickup.y >= 88) {
            this.sprite(
              pickupLabel(pickup.kind).key,
              pickup.x,
              pickup.y + 24,
              36,
              14,
            ).setDepth(PRESENTATION_LAYERS.pickupLabel);
          }
        }
      const moduleAge = model.time - (this.pickupNoticeUntil - 1.6);
      if (this.pickupNoticeUntil > 0 && moduleAge >= 0 && moduleAge < 0.5) {
        const art = pickupVisual(model.lastPickup ?? "power");
        // Brief installation feedback beside the hull, never over the hitbox.
        const y = Math.min(605, model.player.y + 22);
        const x =
          model.player.x < 300 ? model.player.x + 27 : model.player.x - 27;
        this.sprite(
          art.key,
          x,
          y - moduleAge * 12,
          20,
          20,
          1 - moduleAge * 1.6,
        ).setDepth(2);
        overlay.lineStyle(1, art.color, 1 - moduleAge * 2);
        overlay.lineBetween(
          x,
          y + 9,
          model.player.x,
          Math.min(620, model.player.y + 20),
        );
      }
      if (model.boss?.active)
        drawBoss(model.boss, this.sprite.bind(this), overlay, model.time);
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
        if (life <= 0 || e.kind === "pickup") continue;
        const duration = e.duration ?? (e.kind === "hit" ? 0.25 : 0.45);
        renderedImpactPrimitives += drawImpact(
          impacts,
          e.x,
          e.y,
          duration - life,
          e.kind === "hit" ? "hit" : e.kind === "boss" ? "boss" : "destroy",
          1,
          Math.floor(e.x * 7 + e.y * 13),
          duration,
        );
      }
    } else {
      graphics.lineStyle(1, 0x7de7d5, 0.3);
      graphics.strokeCircle(180, 390, 94);
      graphics.strokeCircle(180, 390, 115);
      graphics.lineBetween(180, 265, 180, 520);
      graphics.lineBetween(55, 390, 305, 390);
      ["heal", "power", "spread", "beam", "missile", "support"].forEach(
        (kind, i) => {
          this.sprite(
            pickupVisual(kind).key,
            55 + i * 50,
            576,
            30,
            30,
          ).setDepth(4);
          this.sprite(pickupLabel(kind).key, 55 + i * 50, 600, 36, 14).setDepth(
            4,
          );
        },
      );
      this.sprite("player", 180, 82, 80, 80, 0.85, Math.sin(this.ambience) * 3);
      this.sprite("fire03", 180, 127, 10, 20, 0.9, 180);
    }
    if (model.mode !== "menu") {
      hud.fillStyle(0x0c2133, 1);
      hud.fillRect(0, 0, 360, 72);
      if (model.boss?.active) {
        hud.fillStyle(0x421f3c);
        hud.fillRect(16, 63, 328, 6);
        hud.fillStyle(0xff83b9);
        hud.fillRect(
          16,
          63,
          328 * Math.max(0, model.boss.hp / model.boss.maxHp),
          7,
        );
      }
    }
    if (model.mode !== "menu") {
      const sections = model.boss?.active ? [] : (model.stage.sections ?? []);
      sections.forEach((section, i) => {
        const active = model.time >= section.at;
        hud.fillStyle(active ? 0x8ce5d0 : 0x314b58, active ? 0.9 : 0.55);
        const segment = 328 / Math.max(1, sections.length);
        hud.fillRect(16 + i * segment, 67, segment - 5, 3);
      });
    }
    label.setText(
      model.mode === "menu"
        ? ""
        : `分數 ${String(model.score).padStart(6, "0")}   生命 ${"♥".repeat(Math.max(0, model.hp))}\n${model.mode === "won" ? "STAGE CLEAR" : model.mode === "lost" ? "MISSION FAILED" : model.boss?.active ? `${stageDetails(selectedStage).boss} P${model.boss.phase} · ${Math.ceil(model.stage.duration - model.time)}s` : (model.section?.title ?? `STAGE ${stageDetails(selectedStage).number}`)}\n${model.weaponMode === "missile" ? "追蹤" : model.weaponMode === "beam" ? "貫穿" : "散射"} ${model.weaponLevel}/3   炸彈 ${model.bombs}${model.supportTime > 0 ? "  僚機 " + Math.ceil(model.supportTime) + "s" : ""}`,
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
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  parent: "game",
  backgroundColor: "#0c2035",
  scene: [FlightScene],
  // Normal Graphics batching; textured Image/Text use the built-in single-quad
  // node separately. Never globally split all effect/background triangles.
  render: { pixelArt: false, antialias: true, batchSize: 4096 },
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
    stageId: model.stage.id,
    seed: stageSeed,
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
        groundSurface: e.groundSurface,
        hp: e.hp,
        maxHp: e.maxHp,
        telegraph: e.telegraph,
        attackAngles: e.attackAngles,
        attackPattern: e.attackPattern,
        attackLanes: e.attackLanes,
        volleyFired: e.volleyFired,
        visibleSince: e.visibleSince,
        shotsFired: e.shotsFired,
        turretAngle: e.turretAngle,
        aimAngle: e.aimAngle,
      })),
    spawnedAir: model.spawnedAir,
    enteredAir: model.enteredAir,
    shots: model.shots,
    groundShotCount: model.groundShotCount,
    enemyBullets: model.enemyBullets.filter((b) => b.active).length,
    hostileProjectiles: model.enemyBullets
      .filter((b) => b.active)
      .map(({ x, y, vx, vy }) => ({ x, y, vx, vy })),
    pickups: model.pickups.filter((p) => p.active).length,
    activePickups: model.pickups
      .filter((p) => p.active)
      .map((p) => ({ kind: p.kind, x: p.x, y: p.y })),
    impactEffects: model.effects.map((e) => ({ ...e })),
    impactLayer: 2.7,
    lastPickup: model.lastPickup,
    pickupNoticeText: readPickupNotice(),
    pickupNoticeBounds: readPickupBounds(),
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
    hudBottom: label ? label.y + label.height : null,
    hudLayer: hud?.depth ?? null,
    combatMaxLayer: readCombatLayer(),
    bossChargeSources:
      model.boss?.active && model.boss.attackWarning > 0
        ? bossChargeSources(model.boss)
        : [],
    background: readBackgroundInfo(),
    metalSprites: readMetalSpriteStatus(game.textures),
    nextAssets: nextAssetStatus(game.textures),
    hostileMissiles: {
      textureKey: ROCKET_ART.key,
      rendered: renderedHostileMissiles,
      bodyPixels: [ROCKET_ART.width, ROCKET_ART.height],
    },
    bossPresentation: {
      ...bossVisual(model.stage.boss?.skin),
      coreState: model.boss ? bossCoreState(model.boss) : null,
      remainingArmour: model.boss ? bossArmourRemaining(model.boss) : 0,
    },
    renderer: {
      type: game.renderer.type,
      batchSize: game.config.batchSize,
      hudBatchRole: textureBatchName(label?.customRenderNodes),
      maxTextures:
        "maxTextures" in game.renderer ? game.renderer.maxTextures : 0,
    },
    renderMetrics: renderMetrics.snapshot(),
    measuredFps: frameTime > 0 ? (frameCount * 1000) / frameTime : 0,
  }),
});

// Read-only frame capture: use Phaser's post-render readPixels path rather than
// the browser compositor. This diagnoses partial headless screenshots without
// changing renderer settings, game time, damage, or the production framebuffer.
Object.defineProperty(window, "__P01_CAPTURE__", {
  value: () =>
    new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Frame capture timeout")),
        5000,
      );
      game.renderer.snapshot((result) => {
        window.clearTimeout(timeout);
        if (result instanceof HTMLImageElement) resolve(result.src);
        else reject(new Error("Expected a rendered image"));
      });
    }),
});

// Original 2D text canvas for distinguishing source drawing from GPU output.
Object.defineProperty(window, "__P01_HUD_SOURCE__", {
  value: () => label.canvas.toDataURL("image/png"),
});
