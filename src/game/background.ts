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
  | "arena"
  | "exit"
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
  { id: "channel", label: "狹港入口", at: 15, fade: 4, scenery: "channel" },
  { id: "harbor", label: "港區火力", at: 32, fade: 5, scenery: "harbor" },
  { id: "elite-basin", label: "港池攔截", at: 40, fade: 3, scenery: "arena" },
  { id: "harbor-exit", label: "突破港區", at: 50, fade: 3, scenery: "exit" },
  { id: "approach", label: "補給水域", at: 56, fade: 4, scenery: "approach" },
  { id: "command", label: "指揮艦區", at: 70, fade: 5, scenery: "command" },
];

export type CoastalLandmarkKind = "tanks" | "warehouse" | "crane" | "emptyDock";
export interface CoastalLandmarkConfig {
  readonly id: string;
  readonly kind: CoastalLandmarkKind;
  readonly side: "left" | "right";
  /** World distance at which the landmark's top crosses viewport y=0. */
  readonly distance: number;
}
export const COAST_LANDMARKS: readonly CoastalLandmarkConfig[] = [
  { id: "fuel-berth", kind: "tanks", side: "left", distance: 1056 },
  { id: "cargo-hall", kind: "warehouse", side: "right", distance: 1280 },
  { id: "loading-crane", kind: "crane", side: "left", distance: 1536 },
  { id: "vacant-berth", kind: "emptyDock", side: "right", distance: 1760 },
];
const LANDMARK_HEIGHT = 144;
export function coastalLandmarkY(
  distance: number,
  landmark: CoastalLandmarkConfig,
): number {
  return distance - landmark.distance;
}

const SCENERY_LAYERS: Record<
  CoastalScenery,
  readonly [number, number, number]
> = {
  offshore: [0.35, 0, 0],
  channel: [1, 0, 0],
  harbor: [0, 1, 0],
  arena: [0, 0.3, 0],
  exit: [0.15, 0.1, 0],
  approach: [0.2, 0, 0],
  command: [0, 0, 1],
};

/** Ground silhouette, rather than tint alone, establishes each section. */
const COAST_OPACITY: Record<CoastalScenery, number> = {
  offshore: 0.72,
  channel: 0.14,
  harbor: 0.1,
  arena: 0.025,
  exit: 0.025,
  approach: 0,
  command: 0.035,
};
const SCENERY_ATMOSPHERE: Record<CoastalScenery, number> = {
  offshore: 0,
  channel: 0.06,
  harbor: 0.08,
  arena: 0.12,
  exit: 0.04,
  approach: 0,
  command: 0.16,
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
  target = { index: 0, area: "", areaLabel: "", transition: 1 },
) {
  validateAreas(areas);
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  let index = 0;
  for (let i = 1; i < areas.length; i++) if (t >= areas[i].at) index = i;
  const area = areas[index];
  const progress =
    index > 0 && area.fade ? Math.min(1, (t - area.at) / area.fade) : 1;
  const blend = progress * progress * (3 - 2 * progress);
  target.index = index;
  target.area = area.id;
  target.areaLabel = area.label;
  target.transition = blend;
  return target;
}

export function coastalScrollState(
  time: number,
  target = {
    distance: 0,
    offset: 0,
    coastY: [0, 0, 0, 0],
    currentOffset: 0,
    cloudOffset: 0,
  },
) {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const offset = (t * COAST_SCROLL.speed) % COAST_SCROLL.stride;
  target.distance = t * COAST_SCROLL.speed;
  target.offset = offset;
  for (let i = 0; i < 4; i++)
    target.coastY[i] = offset + (i - 2) * COAST_SCROLL.stride;
  target.currentOffset = (t * COAST_SCROLL.currentSpeed) % COAST_SCROLL.height;
  target.cloudOffset = (t * COAST_SCROLL.cloudSpeed) % 960;
  return target;
}

/** Repeated art panels overlap only at softly masked edges, never hard-cut. */
export function harborArtState(
  distance: number,
  height: number,
  target = { stride: 0, y: [0, 0, 0, 0] },
) {
  const overlap = Math.min(90, height / 4);
  target.stride = height - overlap;
  const offset =
    Math.max(0, Number.isFinite(distance) ? distance : 0) % target.stride;
  for (let i = 0; i < 4; i++) target.y[i] = offset + (i - 2) * target.stride;
  return target;
}

/** Four reused overlapping coast images above a permanent original ocean layer. */
export class CoastalBackground {
  private coast: Phaser.GameObjects.Image[] = [];
  private harborArt: Phaser.GameObjects.Image[] = [];
  private harborArtHeight = 720;
  private harborArtScroll = harborArtState(0, 720);
  private harborArtAlpha = 0;
  private currents: Phaser.GameObjects.Graphics[] = [];
  private clouds: Phaser.GameObjects.Graphics[] = [];
  private state = coastalScrollState(0);
  private areaState = coastalAreaState(0);
  private navigation: Phaser.GameObjects.Graphics[] = [];
  private harbor: Phaser.GameObjects.Graphics[] = [];
  private command: Phaser.GameObjects.Graphics[] = [];
  private shade: Phaser.GameObjects.Graphics;
  private landmarks: Phaser.GameObjects.Graphics[] = [];
  private passages: { index: number; graphic: Phaser.GameObjects.Graphics }[] =
    [];
  private coastOpacity = COAST_OPACITY.offshore;
  private weights: number[];
  private layers = [0.35, 0, 0];
  readonly coastReady: boolean;

  constructor(
    scene: Phaser.Scene,
    private readonly areas: readonly CoastalAreaConfig[] = COAST_AREAS,
    private readonly landmarkConfig: readonly CoastalLandmarkConfig[] = COAST_LANDMARKS,
  ) {
    validateAreas(areas);
    const ids = new Set<string>();
    for (const landmark of landmarkConfig) {
      if (
        !Number.isFinite(landmark.distance) ||
        landmark.distance < 0 ||
        ids.has(landmark.id) ||
        !["tanks", "warehouse", "crane", "emptyDock"].includes(landmark.kind) ||
        !["left", "right"].includes(landmark.side)
      )
        throw new RangeError(
          "Landmarks require unique IDs, a valid kind/side and nonnegative distance",
        );
      ids.add(landmark.id);
    }
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

    // New original illustration owns the port silhouette. Legacy geometry is only
    // a fallback when the optional asset is unavailable, never an overlay on art.
    const harborKey = "p01-harbor-soft-edge";
    if (scene.textures.exists("harbor-battlefield")) {
      const source = scene.textures
        .get("harbor-battlefield")
        .getSourceImage() as HTMLImageElement;
      this.harborArtHeight = (source.height * 360) / source.width;
      if (!scene.textures.exists(harborKey)) {
        const canvas = scene.textures.createCanvas(
          harborKey,
          source.width,
          source.height,
        );
        if (canvas) {
          const context = canvas.getContext();
          context.drawImage(source, 0, 0);
          context.globalCompositeOperation = "destination-in";
          const edge =
            Math.min(90, this.harborArtHeight / 4) / this.harborArtHeight;
          const mask = context.createLinearGradient(0, 0, 0, source.height);
          mask.addColorStop(0, "rgba(255,255,255,0)");
          mask.addColorStop(edge, "rgba(255,255,255,1)");
          mask.addColorStop(1 - edge, "rgba(255,255,255,1)");
          mask.addColorStop(1, "rgba(255,255,255,0)");
          context.fillStyle = mask;
          context.fillRect(0, 0, source.width, source.height);
          context.globalCompositeOperation = "source-over";
          canvas.refresh();
        }
      }
      if (scene.textures.exists(harborKey)) {
        for (let i = 0; i < 4; i++)
          this.harborArt.push(
            scene.add
              .image(0, 0, harborKey)
              .setOrigin(0, 0)
              .setDisplaySize(360, this.harborArtHeight)
              .setDepth(-10.9),
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
    for (const landmark of landmarkConfig)
      this.landmarks.push(
        this.drawLandmark(scene.add.graphics().setDepth(-10.65), landmark.kind),
      );
    for (let index = 0; index < areas.length; index++) {
      const scenery = areas[index].scenery;
      if (scenery === "channel" || scenery === "arena")
        this.passages.push({
          index,
          graphic: this.drawPassage(
            scene.add.graphics().setDepth(-10.55),
            scenery,
          ),
        });
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
    // Continuous quay only: distinct buildings are placed once in world space.
    for (let side = 0; side < 2; side++) {
      const x = side ? 286 : 0;
      g.fillStyle(0x18363c);
      g.fillRect(x, 0, 74, 640);
      g.lineStyle(2, 0x5a7777, 0.55);
      g.lineBetween(side ? 286 : 74, 0, side ? 286 : 74, 640);
      g.lineStyle(1, 0x28474a, 0.6);
      for (const y of [0, 160, 320, 480]) g.lineBetween(x + 3, y, x + 71, y);
    }
    return g;
  }

  private drawLandmark(
    g: Phaser.GameObjects.Graphics,
    kind: CoastalLandmarkKind,
  ) {
    // 68×144 logical px, intentionally subdued and without target markers.
    g.fillStyle(0x203e43);
    g.fillRect(0, 0, 68, LANDMARK_HEIGHT);
    g.lineStyle(1, 0x456162, 0.65);
    g.lineBetween(3, 0, 3, LANDMARK_HEIGHT);
    g.lineBetween(65, 0, 65, LANDMARK_HEIGHT);
    if (kind === "tanks") {
      g.fillStyle(0x142e35);
      g.fillRect(8, 8, 51, 122);
      for (const y of [38, 96]) {
        g.fillStyle(0x334c4e);
        g.fillEllipse(34, y + 4, 45, 43);
        g.fillStyle(0x516765);
        g.fillEllipse(32, y, 42, 38);
        g.lineStyle(2, 0x71827a, 0.5);
        g.strokeEllipse(32, y, 32, 28);
        g.lineStyle(2, 0x294146, 0.8);
        g.lineBetween(32, y - 12, 32, y + 12);
      }
      g.lineStyle(3, 0x485e5b);
      g.lineBetween(55, 38, 55, 120);
    } else if (kind === "warehouse") {
      g.fillStyle(0x122c33);
      g.fillRect(9, 16, 53, 112);
      g.fillStyle(0x4b5a53);
      g.fillRect(6, 12, 50, 108);
      g.fillStyle(0x53655b);
      g.fillRect(6, 12, 24, 108);
      g.lineStyle(2, 0x293f40, 0.7);
      for (const y of [25, 45, 65, 85, 105]) g.lineBetween(9, y, 53, y);
      g.lineStyle(2, 0x718074, 0.6);
      g.lineBetween(30, 14, 30, 117);
      g.fillStyle(0x233e42);
      g.fillRect(18, 115, 25, 9);
      g.fillStyle(0x6a7865, 0.55);
      g.fillRect(18, 127, 25, 3);
    } else if (kind === "crane") {
      g.fillStyle(0x31494b);
      g.fillRect(20, 94, 28, 31);
      g.fillStyle(0x56645a);
      g.fillRect(23, 98, 22, 19);
      g.lineStyle(5, 0x6b7460, 0.8);
      g.lineBetween(34, 105, 34, 25);
      g.lineBetween(12, 25, 59, 25);
      g.lineStyle(1, 0x97a08b, 0.55);
      g.lineBetween(34, 39, 14, 25);
      g.lineBetween(34, 39, 57, 25);
      g.lineBetween(55, 27, 55, 70);
      g.lineBetween(55, 70, 50, 74);
      g.lineStyle(1, 0x273f40);
      g.lineBetween(26, 95, 26, 32);
    } else {
      // Deliberately empty loading berth gives the port visual breathing room.
      g.fillStyle(0x263f43);
      g.fillRect(7, 10, 54, 119);
      g.lineStyle(2, 0x6c7661, 0.45);
      for (const y of [19, 123]) {
        g.lineBetween(14, y, 27, y);
        g.lineBetween(40, y, 53, y);
      }
      g.lineStyle(1, 0x5c736b, 0.4);
      g.lineBetween(14, 19, 14, 123);
      g.lineBetween(53, 19, 53, 123);
      g.fillStyle(0x122f36);
      for (const y of [37, 93]) g.fillEllipse(61, y, 7, 11);
    }
    return g;
  }

  private drawPassage(
    g: Phaser.GameObjects.Graphics,
    kind: "channel" | "arena",
  ) {
    // One world-space structure per configured event, not repeating terrain tiles.
    // Every solid silhouette stays outside x=90..270. These are not collision walls.
    for (let side = 0; side < 2; side++) {
      const edge = side ? 288 : 0;
      if (kind === "channel") {
        // Long tapered port breakwaters with wide, unmistakable gate shoulders.
        g.fillStyle(0x13282f);
        g.fillRect(edge, 30, 72, 790);
        g.fillStyle(0x3b5151);
        g.fillRect(edge + 6, 30, 60, 790);
        g.fillStyle(0x233e42);
        g.fillRect(edge + 18, 48, 36, 754);
        const shoulder = side ? 270 : 62;
        g.fillStyle(0x314a4b);
        g.fillRect(shoulder, 140, 28, 190);
        g.fillStyle(0x506361);
        g.fillRect(shoulder + 5, 146, 18, 178);
        g.lineStyle(2, 0x789181, 0.5);
        g.lineBetween(side ? 272 : 88, 148, side ? 272 : 88, 324);
        for (const y of [66, 350, 640, 790]) {
          g.fillStyle(0x4e625d);
          g.fillRect(edge + 12, y, 48, 14);
          g.fillStyle(0x9e956a, 0.5);
          g.fillRect(side ? 290 : 64, y, 5, 14);
        }
      } else {
        // Wide octagonal-looking basin: sparse corner piers, open combat water.
        const x = side ? 310 : 0;
        g.fillStyle(0x2e4247);
        g.fillRect(x, 0, 50, 900);
        g.fillStyle(0x42575a);
        g.fillRect(x + 8, 0, 34, 900);
        for (const y of [70, 640]) {
          const berth = side ? 277 : 0;
          g.fillStyle(0x182d36);
          g.fillRect(berth, y + 6, 83, 138);
          g.fillStyle(0x3f5154);
          g.fillRect(berth, y, 83, 128);
          g.fillStyle(0x263d44);
          g.fillRect(berth + 8, y + 12, 67, 102);
          g.lineStyle(2, 0x718179, 0.35);
          g.lineBetween(berth + 12, y + 18, berth + 71, y + 18);
          g.lineBetween(berth + 12, y + 108, berth + 71, y + 108);
        }
        // Submerged mooring lines are deliberately faint, not false aiming guides.
        g.lineStyle(1, 0x56767a, 0.16);
        g.lineBetween(side ? 304 : 56, 230, side ? 304 : 56, 615);
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
    coastalScrollState(time, this.state);
    coastalAreaState(time, this.areas, this.areaState);
    this.weights.fill(0);
    this.weights[this.areaState.index] = this.areaState.transition;
    if (this.areaState.index > 0)
      this.weights[this.areaState.index - 1] = 1 - this.areaState.transition;
    this.layers.fill(0);
    this.coastOpacity = 0;
    let atmosphere = 0;
    this.harborArtAlpha = 0;
    for (let i = 0; i < this.areas.length; i++) {
      const scenery = this.areas[i].scenery;
      const profile = SCENERY_LAYERS[scenery];
      const artWeight =
        scenery === "offshore" || scenery === "approach"
          ? 0
          : scenery === "exit"
            ? 0.5
            : scenery === "command"
              ? 0.55
              : 1;
      this.harborArtAlpha += artWeight * this.weights[i];
      this.coastOpacity += COAST_OPACITY[scenery] * this.weights[i];
      atmosphere += SCENERY_ATMOSPHERE[scenery] * this.weights[i];
      for (let layer = 0; layer < 3; layer++)
        this.layers[layer] += profile[layer] * this.weights[i];
    }
    const [navigationAlpha, harborAlpha, commandAlpha] = this.layers;
    const legacyAlpha = this.harborArt.length ? 0 : 1;
    harborArtState(
      this.state.distance,
      this.harborArtHeight,
      this.harborArtScroll,
    );
    for (let i = 0; i < this.harborArt.length; i++)
      this.harborArt[i]
        .setPosition(0, this.harborArtScroll.y[i])
        .setAlpha(this.harborArtAlpha);
    for (let i = 0; i < this.coast.length; i++) {
      this.coast[i]
        .setPosition(0, this.state.coastY[i])
        .setAlpha(this.coastOpacity);
    }
    const groundOffset = this.state.distance % 640;
    for (let i = 0; i < 2; i++) {
      const y = groundOffset - i * 640;
      this.navigation[i].setPosition(0, y).setAlpha(navigationAlpha);
      this.harbor[i].setPosition(0, y).setAlpha(harborAlpha * legacyAlpha);
      this.command[i].setPosition(0, y).setAlpha(commandAlpha * legacyAlpha);
    }
    for (let i = 0; i < this.landmarks.length; i++) {
      const config = this.landmarkConfig[i];
      const y = coastalLandmarkY(this.state.distance, config);
      this.landmarks[i]
        .setPosition(config.side === "left" ? 4 : 288, y)
        .setAlpha(harborAlpha * legacyAlpha)
        .setVisible(y > -LANDMARK_HEIGHT && y < 640 && harborAlpha > 0);
    }
    for (let i = 0; i < this.passages.length; i++) {
      const passage = this.passages[i];
      const area = this.areas[passage.index];
      const y = this.state.distance - area.at * COAST_SCROLL.speed - 180;
      passage.graphic
        .setPosition(0, y)
        .setAlpha(this.weights[passage.index] * legacyAlpha)
        .setVisible(this.weights[passage.index] > 0 && y < 640 && y > -900);
    }
    this.shade.setAlpha(atmosphere);
    for (let i = 0; i < this.currents.length; i++)
      this.currents[i].setPosition(0, this.state.currentOffset - i * 640);
    for (let i = 0; i < this.clouds.length; i++)
      this.clouds[i].setPosition(
        i % 2 ? 345 : 10,
        ((this.state.cloudOffset + i * 320) % 960) - 160,
      );
  }

  diagnostics() {
    return {
      ...this.state,
      ...this.areaState,
      coastY: [...this.state.coastY],
      sceneryWeights: [...this.weights],
      coastOpacity: this.coastOpacity,
      passages: this.passages.map(({ index }) => ({
        id: this.areas[index].id,
        kind: this.areas[index].scenery,
        y:
          this.state.distance - this.areas[index].at * COAST_SCROLL.speed - 180,
        alpha: this.weights[index],
      })),
      layerAlphas: [...this.layers],
      sceneryObjects:
        this.navigation.length +
        this.harbor.length +
        this.command.length +
        this.landmarks.length +
        this.passages.length +
        1,
      landmarks: this.landmarkConfig.map((config) => ({
        id: config.id,
        kind: config.kind,
        side: config.side,
        x: config.side === "left" ? 4 : 288,
        y: coastalLandmarkY(this.state.distance, config),
      })),
      speed: COAST_SCROLL.speed,
      currentSpeed: COAST_SCROLL.currentSpeed,
      cloudSpeed: COAST_SCROLL.cloudSpeed,
      coastReady: this.coastReady,
      coastImages: this.coast.length,
      harborArtReady: this.harborArt.length > 0,
      harborArtImages: this.harborArt.length,
      harborArtAlpha: this.harborArtAlpha,
      harborArtY: [...this.harborArtScroll.y],
    };
  }
}
