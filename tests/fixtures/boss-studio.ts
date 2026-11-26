import Phaser from "phaser";
import { FlightModel } from "../../src/game/model";
import { stage01 } from "../../src/data/stage";
import { drawBoss } from "../../src/game/boss-presentation";
import { COMBAT_VECTOR_ASSETS, NEXT_ASSETS } from "../../src/game/next-assets";
import { createEnemyModuleTextures } from "../../src/game/enemy-modules-art";
import { METAL_SPRITES } from "../../src/game/metal-sprites";
import { createCannonTextures } from "../../src/game/cannon-art";
import { configureTextureBatch } from "../../src/game/texture-batching";
import type { BossSkin } from "../../src/game/boss-rigs";
let model: FlightModel;
function reset() {
  const skin = (document.querySelector("#rig") as HTMLSelectElement)
    .value as BossSkin;
  model = new FlightModel({
    ...stage01,
    duration: 999,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, at: 0, skin },
  });
  model.start();
  model.invincible = 999;
}
class Studio extends Phaser.Scene {
  pool: Phaser.GameObjects.Image[] = [];
  i = 0;
  g!: Phaser.GameObjects.Graphics;
  keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  preload() {
    for (const key of COMBAT_VECTOR_ASSETS)
      this.load.image(key, "/assets/original/" + key + ".svg");
    for (const asset of METAL_SPRITES)
      this.load.image(asset.key, "/" + asset.path);
    for (const key of NEXT_ASSETS)
      this.load.image(key, "/assets/original/" + key + ".webp");
    for (const key of ["boss", "player"])
      this.load.image(key, "/assets/original/" + key + ".png");
  }
  create() {
    createEnemyModuleTextures(this);
    createCannonTextures(this);
    this.g = this.add.graphics().setDepth(3);
    this.keys = this.input.keyboard!.createCursorKeys();
    reset();
    Object.defineProperty(window, "__BOSS_STUDIO__", {
      value: () => ({
        time: model.time,
        skin: model.boss?.skin,
        phase: model.boss?.phase,
        pose: model.boss?.motion,
        parts: model.boss?.cannons,
        textures: [
          ...NEXT_ASSETS,
          ...COMBAT_VECTOR_ASSETS,
          "boss",
          "boss-cannon",
          "enemy-gunship",
          "boss-cannon-broken",
          "boss-support",
        ].map((key) => ({
          key,
          ready: this.textures.exists(key),
          source: this.textures.get(key)?.source?.[0]?.image?.constructor.name,
        })),
      }),
    });
    document.querySelector("#reset")!.addEventListener("click", reset);
    document.querySelector("#rig")!.addEventListener("change", reset);
    document.querySelector("#break")!.addEventListener("click", () => {
      const p = model.boss?.cannons.find((p) => p.active);
      if (p) {
        p.hp = 0;
        p.active = false;
      }
    });
  }
  update(_t: number, ms: number) {
    const phase = Number(
      (document.querySelector("#phase") as HTMLSelectElement).value,
    );
    if (model.boss)
      model.boss.hp =
        model.boss.maxHp * (phase === 1 ? 1 : phase === 2 ? 0.5 : 0.2);
    model.update(
      Math.min(ms / 1000, 0.05),
      Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
    );
    this.g.clear();
    this.i = 0;
    const sprite = (
      key: string,
      x: number,
      y: number,
      w: number,
      h: number,
      a = 1,
      r = 0,
    ) => {
      let image = this.pool[this.i];
      if (!image) {
        image = this.add.image(x, y, key);
        configureTextureBatch(image);
        this.pool.push(image);
      }
      this.i++;
      return image
        .setTexture(key)
        .setPosition(x, y)
        .setDisplaySize(w, h)
        .setAlpha(a)
        .setAngle(r)
        .setDepth(1)
        .setVisible(true);
    };
    if (model.boss?.active) drawBoss(model.boss, sprite, this.g, model.time);
    sprite("player", model.player.x, model.player.y, 32, 32);
    for (const b of model.enemyBullets)
      if (b.active) this.g.fillStyle(0xffa56b).fillCircle(b.x, b.y, 2.5);
    for (let i = this.i; i < this.pool.length; i++)
      this.pool[i].setVisible(false);
    document.querySelector("#status")!.textContent =
      `${model.boss?.motion?.state ?? "approach"} · 部件 ${model.boss?.cannons.filter((p) => p.active).length ?? 0} · 發射 ${model.emittedBossShots}`;
  }
}
new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  width: 360,
  height: 640,
  backgroundColor: "#23313b",
  render: { batchSize: 4096 },
  scene: Studio,
});
