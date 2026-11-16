import type Phaser from "phaser";

/** Coast source is 720×1080; display at half size, blending 180 source pixels. */
export const COAST_SCROLL = {
  width: 360,
  height: 640,
  imageHeight: 540,
  sourceFade: 180,
  overlap: 90,
  stride: 450,
  speed: 32,
  currentSpeed: 60,
  cloudSpeed: 85,
} as const;

export function coastalScrollState(time: number) {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const offset = (t * COAST_SCROLL.speed) % COAST_SCROLL.stride;
  return {
    distance: t * COAST_SCROLL.speed,
    offset,
    coastY: [
      offset - 2 * COAST_SCROLL.stride,
      offset - COAST_SCROLL.stride,
      offset,
      offset + COAST_SCROLL.stride,
    ],
    currentOffset: (t * COAST_SCROLL.currentSpeed) % COAST_SCROLL.height,
    cloudOffset: (t * COAST_SCROLL.cloudSpeed) % 960,
  };
}

/** Four reused overlapping coast images above a permanent original ocean layer. */
export class CoastalBackground {
  private coast: Phaser.GameObjects.Image[] = [];
  private currents: Phaser.GameObjects.Graphics[] = [];
  private clouds: Phaser.GameObjects.Graphics[] = [];
  private state = coastalScrollState(0);
  readonly coastReady: boolean;

  constructor(scene: Phaser.Scene) {
    const sea = scene.add.graphics().setDepth(-12);
    sea.fillStyle(0x103842);
    sea.fillRect(0, 0, COAST_SCROLL.width, COAST_SCROLL.height);
    // Never rely on the non-seamless bitmap to cover the viewport by itself.
    sea.fillStyle(0x0b303b, 0.45);
    sea.fillRect(92, 0, 176, COAST_SCROLL.height);

    const key = "p01-coast-soft-edge";
    if (!scene.textures.exists(key) && scene.textures.exists("coast")) {
      const canvas = scene.textures.createCanvas(key, 720, 1080);
      if (canvas) {
        const context = canvas.getContext();
        context.drawImage(
          scene.textures.get("coast").getSourceImage() as CanvasImageSource,
          0,
          0,
          720,
          1080,
        );
        context.globalCompositeOperation = "destination-in";
        const mask = context.createLinearGradient(0, 0, 0, 1080);
        mask.addColorStop(0, "rgba(255,255,255,0)");
        mask.addColorStop(180 / 1080, "rgba(255,255,255,1)");
        mask.addColorStop(900 / 1080, "rgba(255,255,255,1)");
        mask.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = mask;
        context.fillRect(0, 0, 720, 1080);
        context.globalCompositeOperation = "source-over";
        canvas.refresh();
      }
    }
    this.coastReady = scene.textures.exists(key);
    if (this.coastReady) {
      for (let i = 0; i < 4; i++) {
        this.coast.push(
          scene.add
            .image(0, 0, key)
            .setOrigin(0, 0)
            .setDisplaySize(360, 540)
            .setAlpha(0.84)
            .setDepth(-11),
        );
      }
    }

    // Subtle, original water streaks, separate from the bitmap's slower drift.
    for (let tile = 0; tile < 2; tile++) {
      const flow = scene.add.graphics().setDepth(-10);
      flow.lineStyle(1, 0x8bd8d2, 0.06);
      for (let i = 0; i < 26; i++) {
        const x = (i * 137 + 19) % 360;
        const y = (i * 89 + 13) % 640;
        flow.lineBetween(x, y, x + 5, y + 26);
      }
      this.currents.push(flow);
    }
    // Clouds stay near the sides, leaving the central firing lane readable.
    for (let i = 0; i < 3; i++) {
      const cloud = scene.add.graphics().setDepth(-9);
      cloud.fillStyle(0xd2eeeb, 0.035);
      cloud.fillEllipse(0, 0, 200, 110);
      cloud.fillEllipse(-30, -16, 150, 80);
      cloud.fillEllipse(33, 21, 180, 85);
      this.clouds.push(cloud);
    }
    this.update(0);
  }

  update(time: number) {
    this.state = coastalScrollState(time);
    this.coast.forEach((image, i) =>
      image.setPosition(0, this.state.coastY[i]),
    );
    this.currents.forEach((flow, i) =>
      flow.setPosition(0, this.state.currentOffset - i * 640),
    );
    this.clouds.forEach((cloud, i) =>
      cloud.setPosition(
        i % 2 ? 345 : 10,
        ((this.state.cloudOffset + i * 320) % 960) - 160,
      ),
    );
  }

  diagnostics() {
    return {
      ...this.state,
      coastY: [...this.state.coastY],
      speed: COAST_SCROLL.speed,
      currentSpeed: COAST_SCROLL.currentSpeed,
      cloudSpeed: COAST_SCROLL.cloudSpeed,
      coastReady: this.coastReady,
      coastImages: this.coast.length,
    };
  }
}
