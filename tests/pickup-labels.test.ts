import { expect, it } from "vitest";
import {
  createPickupLabelTextures,
  pickupLabel,
  pickupMessage,
} from "../src/game/pickup-labels";

it("six two-character labels retain sprite aliases and stable distinct keys", () => {
  const kinds = ["heal", "power", "spread", "beam", "missile", "support"];
  expect(kinds.map((k) => pickupLabel(k).text)).toEqual([
    "修復",
    "升級",
    "散射",
    "光束",
    "飛彈",
    "僚機",
  ]);
  expect(new Set(kinds.map((k) => pickupLabel(k).key)).size).toBe(6);
  for (const kind of kinds) expect(pickupLabel(kind).text.length).toBe(2);
  expect(pickupLabel("double")).toBe(pickupLabel("power"));
  expect(pickupLabel("wingman")).toBe(pickupLabel("support"));
  expect(pickupLabel("unknown")).toBe(pickupLabel("power"));
});
it("labels create 72x28 textures once with high-contrast text and a narrow class stripe", () => {
  const made = new Map<string, { rects: unknown[]; texts: unknown[] }>();
  let refresh = 0;
  const scene: any = {
    textures: {
      exists: (key: string) => made.has(key),
      createCanvas(key: string, w: number, h: number) {
        expect([w, h]).toEqual([72, 28]);
        const record = { rects: [] as unknown[], texts: [] as unknown[] };
        made.set(key, record);
        const c: any = {
          clearRect() {},
          fillStyle: "",
          font: "",
          textAlign: "",
          textBaseline: "",
          fillRect(...args: number[]) {
            record.rects.push([this.fillStyle, ...args]);
          },
          fillText(...args: unknown[]) {
            record.texts.push([
              this.fillStyle,
              this.font,
              this.textAlign,
              this.textBaseline,
              ...args,
            ]);
          },
        };
        return {
          getContext: () => c,
          refresh() {
            refresh++;
          },
        };
      },
    },
  };
  createPickupLabelTextures(scene);
  createPickupLabelTextures(scene);
  expect(made.size).toBe(6);
  expect(refresh).toBe(6);
  for (const record of made.values()) {
    expect(record.rects[0]).toEqual(["#071119", 0, 0, 72, 28]);
    expect((record.rects[1] as unknown[]).slice(1)).toEqual([2, 2, 5, 24]);
    expect(record.texts).toHaveLength(1);
    const text = record.texts[0] as unknown[];
    expect(text[0]).toBe("#ffffff");
    expect(text[1]).toContain("sans-serif");
    expect(text.slice(2, 4)).toEqual(["center", "middle"]);
    expect(text.slice(-2)).toEqual([40, 15]);
  }
});
it("label allocation failure leaves play available", () => {
  const scene: any = {
    textures: { exists: () => false, createCanvas: () => null },
  };
  expect(() => createPickupLabelTextures(scene)).not.toThrow();
});
it("pickup feedback describes post-pickup model values without inventing a prior state", () => {
  expect(pickupMessage("heal", 2, 2)).toBe("裝甲 2/3");
  expect(pickupMessage("heal", 3, 3)).toBe("裝甲 3/3");
  expect(pickupMessage("power", 3, 2)).toBe("火力 LV3/3");
  expect(pickupMessage("double", 2, 3)).toBe("火力 LV2/3");
  expect(pickupMessage("spread", 1, 3)).toBe("散射 LV1");
  expect(pickupMessage("beam", 2, 3)).toBe("貫穿光束 LV2");
  expect(pickupMessage("missile", 3, 3)).toBe("追蹤飛彈 LV3");
  expect(pickupMessage("support", 2, 3)).toBe("僚機支援 8秒");
  expect(pickupMessage("wingman", 2, 3)).toBe("僚機支援 8秒");
  expect(pickupMessage("unknown", 2, 3)).toBe("火力 LV2/3");
});
