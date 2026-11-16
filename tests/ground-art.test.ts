import { expect, it } from "vitest";
import { createGroundTextures } from "../src/game/ground-art";
it("creates reusable original ground platform silhouettes once", () => {
  const textures = new Map<string, string[]>();
  const scene: any = {
    textures: {
      exists: (key: string) => textures.has(key),
      createCanvas: (key: string, w: number, h: number) => {
        expect([w, h]).toEqual([96, 96]);
        const trace: string[] = [];
        textures.set(key, trace);
        const context: any = {};
        for (const name of [
          "fillRect",
          "strokeRect",
          "beginPath",
          "moveTo",
          "lineTo",
          "stroke",
          "arc",
          "fill",
        ])
          context[name] = (...args: unknown[]) =>
            trace.push(name + args.join(","));
        return { getContext: () => context, refresh() {} };
      },
    },
  };
  createGroundTextures(scene);
  createGroundTextures(scene);
  expect(textures.size).toBe(2);
  expect(textures.get("groundBattery")).not.toEqual(
    textures.get("groundDepot"),
  );
});
