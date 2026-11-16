import type Phaser from "phaser";
import { GROUND_SCROLL_SPEED } from "../data/stage";

/** Coast source is 720×1080; display at half size, blending 180 source pixels. */
export const COAST_SCROLL = {
  width: 360,
  height: 640,
  imageHeight: 540,
  sourceFade: 180,
  overlap: 90,
  stride: 450,
  speed: GROUND_SCROLL_SPEED,
  currentSpeed: 60,
  cloudSpeed: 85,
} as const;

export type CoastalScenery =
  | "offshore"
  | "channel"
  | "harbor"
  | "approach"
  | "command";
export interface CoastalAreaConfig {
  readonly id: string;
  readonly label: string;
  readonly at: number;
  readonly fade: number;
  readonly scenery: CoastalScenery;
}

/** Pure timing/composition data; profiles can be reordered or repeated. */
export const COAST_AREAS: readonly CoastalAreaConfig[] = [
  { id: "offshore", label: "外海試探", at: 0, fade: 0, scenery: "offshore" },
  { id: "channel", label: "交叉航道", at: 15, fade: 4, scenery: "channel" },
  { id: "harbor", label: "港區火力", at: 32, fade: 5, scenery: "harbor" },
  { id: "approach", label: "補給接近", at: 56, fade: 5, scenery: "approach" },
  { id: "command", label: "指揮艦區", at: 70, fade: 5, scenery: "command" },
];

const SCENERY_LAYERS: Record<
  CoastalScenery,
  readonly [number, number, number]
> = {
  offshore: [0.35, 0, 0],
  channel: [1, 0, 0],
  harbor: [0, 1, 0],
  approach: [0, 0.45, 0.65],
  command: [0, 0, 1],
};

function validateAreas(areas: readonly CoastalAreaConfig[]) {
  if (!areas.length || areas[0].at !== 0)
    throw new RangeError("Coastal areas must begin at time 0");
  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    if (
      !Number.isFinite(area.at) ||
      !Number.isFinite(area.fade) ||
      area.fade < 0 ||
      !(area.scenery in SCENERY_LAYERS) ||
      (i > 0 && area.at <= areas[i - 1].at)
    )
      throw new RangeError(
        "Coastal areas need increasing times, nonnegative fades and known scenery",
      );
    if (i > 0 && areas[i - 1].at + areas[i - 1].fade > area.at)
      throw new RangeError(
        "Coastal area fades must finish before the next transition",
      );
  }
}

export function coastalAreaState(
  time: number,
  areas: readonly CoastalAreaConfig[] = COAST_AREAS,
) {
  validateAreas(areas);
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  let index = 0;
  for (let i = 1; i < areas.length; i++) if (t >= areas[i].at) index = i;
  const area = areas[index];
  const progress =
    index > 0 && area.fade ? Math.min(1, (t - area.at) / area.fade) : 1;
  const blend = progress * progress * (3 - 2 * progress);
  return { index, area: area.id, areaLabel: area.label, transition: blend };
}

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
  private areaState = coastalAreaState(0);
  private navigation: Phaser.GameObjects.Graphics[] = [];
  private harbor: Phaser.GameObjects.Graphics[] = [];
  private command: Phaser.GameObjects.Graphics[] = [];
  private shade: Phaser.GameObjects.Graphics;
  private weights: number[];
  private layers = [0.35, 0, 0];
  readonly coastReady: boolean;

  constructor(
    scene: Phaser.Scene,
    private readonly areas: readonly CoastalAreaConfig[] = COAST_AREAS,
  ) {
    validateAreas(areas);
    this.weights = new Array(areas.length).fill(0);
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
    // Each geometry tile is authored once. All scenery remains behind bullets.
    for (let i = 0; i < 2; i++) {
      this.navigation.push(
        this.drawNavigation(scene.add.graphics().setDepth(-10.8)),
      );
      this.harbor.push(this.drawHarbor(scene.add.graphics().setDepth(-10.7)));
      this.command.push(this.drawCommand(scene.add.graphics().setDepth(-10.6)));
    }
    this.shade = scene.add.graphics().setDepth(-10.5);
    this.shade.fillStyle(0x081321);
    this.shade.fillRect(0, 0, 360, 640);
    this.update(0);
  }

  private drawNavigation(g: Phaser.GameObjects.Graphics) {
    // A pair of low-contrast guide buoys marks the crossing shipping lane.
    for (const y of [80, 240, 400, 560]) {
      for (const x of [79, 281]) {
        g.fillStyle(0x173b3f);
        g.fillEllipse(x, y + 6, 17, 27);
        g.fillStyle(0x496963);
        g.fillRect(x - 4, y - 10, 8, 20);
        g.fillStyle(x < 180 ? 0x719485 : 0x9d8c67, 0.65);
        g.fillRect(x - 3, y - 10, 6, 4);
      }
    }
    return g;
  }

  private drawHarbor(g: Phaser.GameObjects.Graphics) {
    for (let side = 0; side < 2; side++) {
      const x = side ? 286 : 0;
      g.fillStyle(0x18363c);
      g.fillRect(x, 0, 74, 640);
      g.lineStyle(2, 0x5a7777, 0.55);
      g.lineBetween(side ? 286 : 74, 0, side ? 286 : 74, 640);
      for (const y of [40, 220, 400, 580]) {
        g.fillStyle(0x29494c);
        g.fillRect(x + 6, y, 61, 42);
        g.fillStyle(0x40605e, 0.75);
        g.fillRect(x + 10, y + 4, 24, 32);
        g.fillStyle(0x4b5a51, 0.75);
        g.fillRect(x + 37, y + 4, 24, 32);
        g.lineStyle(1, 0x142f35, 0.8);
        for (let n = 0; n < 4; n++) {
          g.lineBetween(x + 12, y + 10 + n * 7, x + 31, y + 10 + n * 7);
          g.lineBetween(x + 39, y + 10 + n * 7, x + 58, y + 10 + n * 7);
        }
        // Fixed overhead crane: confined to the dock, not the central lane.
        g.lineStyle(4, 0x5d705e, 0.8);
        const inner = side ? x + 12 : x + 62;
        g.lineBetween(inner, y + 65, inner, y + 125);
        g.lineBetween(inner, y + 65, side ? x + 65 : x + 5, y + 65);
        g.lineStyle(1, 0x7c8e77, 0.7);
        g.lineBetween(
          side ? x + 50 : x + 20,
          y + 65,
          side ? x + 50 : x + 20,
          y + 89,
        );
      }
    }
    return g;
  }

  private drawCommand(g: Phaser.GameObjects.Graphics) {
    // Large carrier-side structures replace the small harbor containers.
    // Central x=90..270 remains open water beneath the actual enemy flagship.
    for (let side = 0; side < 2; side++) {
      const x = side ? 292 : -14;
      g.fillStyle(0x182830);
      g.fillRect(x, 0, 82, 640);
      g.fillStyle(0x34444a);
      g.fillRect(x + 12, 0, 56, 640);
      g.fillStyle(0x1d3038);
      g.fillRect(x + 22, 0, 36, 640);
      for (const y of [25, 185, 345, 505]) {
        g.fillStyle(0x3f5355);
        g.fillRect(x + 16, y, 48, 63);
        g.fillStyle(0x16262f);
        g.fillRect(x + 22, y + 8, 36, 46);
        g.lineStyle(2, 0x597072, 0.6);
        for (let n = 0; n < 4; n++)
          g.lineBetween(x + 26, y + 16 + n * 9, x + 54, y + 16 + n * 9);
        g.fillStyle(0x9f7652, 0.6);
        g.fillRect(side ? 294 : 62, y + 100, 4, 14);
        g.fillRect(side ? 294 : 62, y + 122, 4, 14);
      }
    }
    return g;
  }

  update(time: number) {
    this.state = coastalScrollState(time);
    this.areaState = coastalAreaState(time, this.areas);
    this.weights.fill(0);
    this.weights[this.areaState.index] = this.areaState.transition;
    if (this.areaState.index > 0)
      this.weights[this.areaState.index - 1] = 1 - this.areaState.transition;
    this.layers.fill(0);
    for (let i = 0; i < this.areas.length; i++) {
      const profile = SCENERY_LAYERS[this.areas[i].scenery];
      for (let layer = 0; layer < 3; layer++)
        this.layers[layer] += profile[layer] * this.weights[i];
    }
    const [navigationAlpha, harborAlpha, commandAlpha] = this.layers;
    this.coast.forEach((image, i) =>
      image
        .setPosition(0, this.state.coastY[i])
        .setAlpha(0.84 - harborAlpha * 0.26 - commandAlpha * 0.5),
    );
    const groundOffset = this.state.distance % 640;
    for (let i = 0; i < 2; i++) {
      const y = groundOffset - i * 640;
      this.navigation[i].setPosition(0, y).setAlpha(navigationAlpha);
      this.harbor[i].setPosition(0, y).setAlpha(harborAlpha);
      this.command[i].setPosition(0, y).setAlpha(commandAlpha);
    }
    this.shade.setAlpha(commandAlpha * 0.12);
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
      ...this.areaState,
      coastY: [...this.state.coastY],
      sceneryWeights: [...this.weights],
      layerAlphas: [...this.layers],
      sceneryObjects:
        this.navigation.length + this.harbor.length + this.command.length + 1,
      speed: COAST_SCROLL.speed,
      currentSpeed: COAST_SCROLL.currentSpeed,
      cloudSpeed: COAST_SCROLL.cloudSpeed,
      coastReady: this.coastReady,
      coastImages: this.coast.length,
    };
  }
}
