import type Phaser from "phaser";
import { PICKUP_VISUALS, pickupVisual, type PickupArtKind } from "./pickup-art";

export interface PickupLabel {
  readonly key: string;
  readonly text: string;
  readonly color: number;
}
const WORDS: Readonly<Record<PickupArtKind, string>> = {
  heal: "修復",
  power: "升級",
  spread: "散射",
  beam: "光束",
  missile: "飛彈",
  support: "僚機",
};
const LABELS: Readonly<Record<string, Readonly<PickupLabel>>> =
  Object.fromEntries(
    (Object.keys(PICKUP_VISUALS) as PickupArtKind[]).map((kind) => [
      PICKUP_VISUALS[kind].key,
      Object.freeze({
        key: `pickup-label-${kind}`,
        text: WORDS[kind],
        color: PICKUP_VISUALS[kind].color,
      }),
    ]),
  );
/** Alias/fallback rules are exactly those of the existing pickup sprite. */
export function pickupLabel(kind: string): Readonly<PickupLabel> {
  return LABELS[pickupVisual(kind).key];
}

/** Render unrotated at 36×14 below a pickup. Build once, never paint per frame. */
export function createPickupLabelTextures(scene: Phaser.Scene): void {
  for (const label of Object.values(LABELS)) {
    if (scene.textures.exists(label.key)) continue;
    const texture = scene.textures.createCanvas(label.key, 72, 28);
    if (!texture) continue;
    const c = texture.getContext();
    c.clearRect(0, 0, 72, 28);
    c.fillStyle = "#071119";
    c.fillRect(0, 0, 72, 28);
    c.fillStyle = `#${label.color.toString(16).padStart(6, "0")}`;
    c.fillRect(2, 2, 5, 24);
    c.fillStyle = "#ffffff";
    c.font =
      'bold 22px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label.text, 40, 15);
    texture.refresh();
  }
}

/** Call with the model's post-pickup values, not the prior HP/level. */
export function pickupMessage(kind: string, level: number, hp: number): string {
  switch (pickupVisual(kind).key) {
    case "pickup-heal":
      return `裝甲 ${hp}/3`;
    case "pickup-power":
      return `火力 LV${level}/3`;
    case "pickup-spread":
      return `散射 LV${level}`;
    case "pickup-beam":
      return `貫穿光束 LV${level}`;
    case "pickup-missile":
      return `追蹤飛彈 LV${level}`;
    case "pickup-support":
      return "僚機支援 8秒";
    default:
      return `火力 LV${level}/3`;
  }
}
