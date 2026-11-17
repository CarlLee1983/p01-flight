import { expect, it } from "vitest";
import { createRaiderTextures, RAIDER_ART } from "../src/game/raider-art";
it("two original airframes have different draw geometry and are cached", () => {
  const traces = new Map<string, string[]>();
  const scene: any = {
    textures: {
      exists: (key: string) => traces.has(key),
      createCanvas: (key: string, w: number, h: number) => {
        expect([w, h]).toEqual([96, 84]);
        const trace: string[] = [];
        traces.set(key, trace);
        const c: any = {};
        for (const m of [
          "scale",
          "beginPath",
          "moveTo",
          "lineTo",
          "closePath",
          "fill",
          "fillRect",
        ])
          c[m] = (...args: unknown[]) => trace.push(`${m}:${args.join(",")}`);
        return { getContext: () => c, refresh() {} };
      },
    },
  };
  createRaiderTextures(scene);
  createRaiderTextures(scene);
  expect(traces.size).toBe(2);
  expect(new Set([...traces.values()].map((t) => t.join("|"))).size).toBe(2);
  expect(RAIDER_ART.brakeRaider.key).not.toBe(RAIDER_ART.hookWing.key);
});
it("unavailable texture allocation is safe", () => {
  expect(() =>
    createRaiderTextures({
      textures: { exists: () => false, createCanvas: () => null },
    } as any),
  ).not.toThrow();
});
