import type Phaser from "phaser";

export const CANYON_ART = ["river", "bridge", "mine", "dam", "reservoir"] as const;
const TILE_HEIGHT = 450;
/** Deterministic layout; no runtime randomization or scenery collision. */
export function canyonLayout(time: number) {
  const travel = time * 32;
  return {
    travel,
    tileY: [0, 1, 2].map((i) => (travel % TILE_HEIGHT) + (i - 1) * TILE_HEIGHT),
    basinMix: Math.max(0, Math.min(1, (time - 136) / 9)),
    landmarks: ([ [29, "bridge"], [58, "mine"], [123, "dam"] ] as const).map(([at, kind]) => ({ kind, y: travel - at * 32 - 160 })),
  };
}

/** Bakes scrolling seams/section alpha ONCE, never recreates a large bitmap per
 * frame. 720px source width, at most nine cached Image nodes. Image-only quad
 * isolation remains active; no global batch-size override or TileSprite role.
 */
export class CanyonBackground {
  private river: Phaser.GameObjects.Image[] = [];
  private basin: Phaser.GameObjects.Image[] = [];
  private landmarks: Phaser.GameObjects.Image[] = [];
  private time = 0;
  private ready: boolean;
  constructor(scene: Phaser.Scene) {
    this.ready = CANYON_ART.every((kind) => scene.textures.exists("canyon-" + kind));
    if (!this.ready) throw new Error("Canyon terrain assets failed to load");
    for (const kind of CANYON_ART) {
      const key = "canyon-baked-" + kind;
      if (scene.textures.exists(key)) continue;
      const source = scene.textures.get("canyon-" + kind).getSourceImage() as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      const repeating = kind === "river" || kind === "reservoir";
      canvas.height = repeating ? 900 : 1080;
      const ctx = canvas.getContext("2d")!;
      if (repeating) {
        // Output starts at source row180, wraps through the final180 rows into
        // source0..179. Thus adjacent tiles meet at consecutive source rows.
        const tile = document.createElement("canvas");
        tile.width = 720; tile.height = 1080;
        const paint = tile.getContext("2d")!;
        // The arena uses the open middle of the reservoir; do not repeat its
        // top/bottom dam structures across the Boss combat area.
        const top = kind === "reservoir" ? source.height * 0.18 : 0;
        const height = kind === "reservoir" ? source.height * 0.64 : source.height;
        paint.drawImage(source, 0, top, source.width, height, 0, 0, 720, 1080);
        ctx.drawImage(tile, 0, 180, 720, 900, 0, 0, 720, 900);
        for (let row = 0; row < 180; row++) {
          ctx.globalAlpha = row / 179;
          ctx.drawImage(tile, 0, row, 720, 1, 0, 720 + row, 720, 1);
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.drawImage(source, 0, 0, 720, 1080);
        // Section artwork fades through natural terrain at both ends instead
        // of placing a hard rectangular panel across the moving river.
        ctx.globalCompositeOperation = "destination-in";
        const mask = ctx.createLinearGradient(0, 0, 0, 1080);
        mask.addColorStop(0, "rgba(0,0,0,0)");
        mask.addColorStop(0.19, "rgba(0,0,0,1)");
        mask.addColorStop(0.81, "rgba(0,0,0,1)");
        mask.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mask;
        ctx.fillRect(0, 0, 720, 1080);
      }
      scene.textures.addCanvas(key, canvas);
    }
    for (let i = 0; i < 3; i++) {
      this.river.push(scene.add.image(180, 0, "canyon-baked-river").setOrigin(0.5, 0).setDisplaySize(360, TILE_HEIGHT).setDepth(-8).setTint(0xc7cdd0));
      this.basin.push(scene.add.image(180, 0, "canyon-baked-reservoir").setOrigin(0.5, 0).setDisplaySize(360, TILE_HEIGHT).setDepth(-7).setTint(0xc7cdd0));
    }
    for (const kind of ["bridge", "mine", "dam"]) this.landmarks.push(scene.add.image(180, 0, "canyon-baked-" + kind).setOrigin(0.5, 0).setDisplaySize(360, 540).setDepth(-7.5).setTint(0xc7cdd0));
    this.update(0, false);
  }
  update(time: number, visible: boolean) {
    this.time = time;
    const layout = canyonLayout(time);
    this.river.forEach((image, i) => image.setY(layout.tileY[i]).setVisible(visible));
    this.basin.forEach((image, i) => image.setY(layout.tileY[i]).setAlpha(layout.basinMix).setVisible(visible && layout.basinMix > 0));
    this.landmarks.forEach((image, i) => image.setY(layout.landmarks[i].y).setVisible(visible && layout.landmarks[i].y < 640 && layout.landmarks[i].y > -540));
  }
  diagnostics() {
    return { theme: "canyon", time: this.time, worldDistance: this.time * 32, landmarks: ["bridge", "mine", "dam"], terrain: "textured-canyon-and-reservoir", artReady: this.ready, basinMix: canyonLayout(this.time).basinMix, imageNodes: 9, bakesPerScene: 5 };
  }
}
