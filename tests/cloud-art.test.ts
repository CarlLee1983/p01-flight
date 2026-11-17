import { expect, it } from "vitest";
import {
  CLOUD_ART,
  createCloudTextures,
  generateCloudPixels,
  type CloudKind,
} from "../src/game/cloud-art";

it.each(["bank", "wisp"] as CloudKind[])(
  "%s uses deterministic porous muted pixels with fully feathered edges",
  (kind) => {
    const spec = CLOUD_ART[kind];
    const a = generateCloudPixels(kind);
    const b = generateCloudPixels(kind);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(a.length).toBe(spec.width * spec.height * 4);
    const levels = new Set<number>();
    let maxAlpha = 0,
      maxRgb = 0,
      edgeMax = 0;
    let light = 0,
      transparent = 0,
      interiorWindows = 0;
    for (let y = 0; y < spec.height; y++)
      for (let x = 0; x < spec.width; x++) {
        const i = (y * spec.width + x) * 4;
        const alpha = a[i + 3];
        levels.add(alpha);
        maxAlpha = Math.max(maxAlpha, alpha);
        maxRgb = Math.max(maxRgb, a[i], a[i + 1], a[i + 2]);
        if (x === 0 || y === 0 || x === spec.width - 1 || y === spec.height - 1)
          edgeMax = Math.max(edgeMax, alpha);
        if (alpha > 80) light++;
        if (alpha === 0) transparent++;
        if (
          x > spec.width * 0.25 &&
          x < spec.width * 0.75 &&
          y > spec.height * 0.25 &&
          y < spec.height * 0.75 &&
          alpha < 12
        )
          interiorWindows++;
      }
    expect(maxAlpha).toBeLessThanOrEqual(168);
    expect(maxRgb).toBeLessThan(230);
    expect(edgeMax).toBe(0);
    const count = spec.width * spec.height;
    expect(levels.size).toBeGreaterThan(100);
    expect(light / count).toBeGreaterThan(0.1);
    expect(light / count).toBeLessThan(0.45);
    expect(transparent / count).toBeGreaterThan(0.15);
    expect(interiorWindows).toBeGreaterThan(50);
    expect(spec.alpha).toBeLessThanOrEqual(0.3);
  },
);
it("two distinct aspect ratios are allocated once and never redrawn by restart", () => {
  const painted = new Map<string, Uint8ClampedArray>();
  let allocations = 0,
    refreshes = 0;
  const scene: any = {
    textures: {
      exists: (key: string) => painted.has(key),
      createCanvas(key: string, w: number, h: number) {
        allocations++;
        return {
          getContext: () => ({
            createImageData: (width: number, height: number) => {
              expect([width, height]).toEqual([w, h]);
              return { data: new Uint8ClampedArray(w * h * 4) };
            },
            putImageData(
              image: { data: Uint8ClampedArray },
              x: number,
              y: number,
            ) {
              expect([x, y]).toEqual([0, 0]);
              painted.set(key, image.data);
            },
          }),
          refresh() {
            refreshes++;
          },
        };
      },
    },
  };
  createCloudTextures(scene);
  createCloudTextures(scene);
  expect(allocations).toBe(2);
  expect(refreshes).toBe(2);
  expect(painted.size).toBe(2);
  expect(CLOUD_ART.bank.width / CLOUD_ART.bank.height).toBeGreaterThan(1);
  expect(CLOUD_ART.wisp.width / CLOUD_ART.wisp.height).toBeLessThan(1);
  expect(painted.get(CLOUD_ART.bank.key)).toEqual(generateCloudPixels("bank"));
  expect(painted.get(CLOUD_ART.wisp.key)).toEqual(generateCloudPixels("wisp"));
});
it("a failed texture allocation does not prevent startup", () => {
  const scene: any = {
    textures: { exists: () => false, createCanvas: () => null },
  };
  expect(() => createCloudTextures(scene)).not.toThrow();
});
