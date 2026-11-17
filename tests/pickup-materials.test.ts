import { expect, it } from "vitest";
import { createPickupTextures } from "../src/game/pickup-art";

it("mechanical pickups stay within the texture, avoid icon glow/text and have bounded paint work", () => {
  const records: { key: string; calls: number; colors: Set<string> }[] = [];
  const scene: any = {
    textures: {
      exists: () => false,
      createCanvas(key: string, width: number, height: number) {
        const record = { key, calls: 0, colors: new Set<string>() };
        records.push(record);
        const context: any = {
          fillStyle: "",
          strokeStyle: "",
          clearRect() {},
          beginPath() {},
          closePath() {},
          moveTo(x: number, y: number) {
            point(x, y);
          },
          lineTo(x: number, y: number) {
            point(x, y);
          },
          fill() {
            record.calls++;
            record.colors.add(this.fillStyle);
          },
          stroke() {
            record.calls++;
            record.colors.add(this.strokeStyle);
          },
          fillRect(x: number, y: number, w: number, h: number) {
            point(x, y);
            point(x + w, y + h);
            expect(w).toBeGreaterThan(0);
            expect(h).toBeGreaterThan(0);
            record.calls++;
            record.colors.add(this.fillStyle);
          },
          fillText() {
            throw new Error("No tiny text in a 32px mechanical sprite");
          },
          createRadialGradient() {
            throw new Error("No surrounding neon badge glow");
          },
        };
        function point(x: number, y: number) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(height);
        }
        return { getContext: () => context, refresh() {} };
      },
    },
  };
  createPickupTextures(scene);
  expect(records).toHaveLength(6);
  for (const record of records) {
    expect(record.calls).toBeLessThan(85);
    expect(record.colors.size).toBeGreaterThanOrEqual(7);
  }
});
