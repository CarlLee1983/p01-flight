import { describe, expect, it } from "vitest";
import {
  createPickupTextures,
  PICKUP_VISUALS,
  pickupVisual,
} from "../src/game/pickup-art";

describe("original readable pickup icons", () => {
  it("six pickup types have distinct keys and labels, including legacy aliases", () => {
    const icons = Object.values(PICKUP_VISUALS);
    expect(icons).toHaveLength(6);
    expect(new Set(icons.map((i) => i.key)).size).toBe(6);
    expect(new Set(icons.map((i) => i.shortLabel)).size).toBe(6);
    expect(pickupVisual("support").shortLabel).toBe("W");
    expect(pickupVisual("double")).toBe(PICKUP_VISUALS.power);
    expect(pickupVisual("wingman")).toBe(PICKUP_VISUALS.support);
    expect(pickupVisual("unknown")).toBe(PICKUP_VISUALS.power);
  });
  it("draws distinct geometry and caches all six 64px textures on restart", () => {
    const traces = new Map<string, string[]>();
    let created = 0,
      refreshed = 0;
    const scene: any = {
      textures: {
        exists: (key: string) => traces.has(key),
        createCanvas: (key: string, width: number, height: number) => {
          expect([width, height]).toEqual([64, 64]);
          created++;
          const log: string[] = [];
          traces.set(key, log);
          const context: any = {};
          for (const method of [
            "clearRect",
            "fillRect",
            "beginPath",
            "moveTo",
            "lineTo",
            "closePath",
            "fill",
            "stroke",
            "fillText",
            "arc",
            "quadraticCurveTo",
          ])
            context[method] = (...args: unknown[]) =>
              log.push(`${method}:${args.join(",")}`);
          context.createRadialGradient = () => ({ addColorStop() {} });
          return { getContext: () => context, refresh: () => refreshed++ };
        },
      },
    };
    createPickupTextures(scene);
    expect(created).toBe(6);
    expect(refreshed).toBe(6);
    // Compare draw commands, not fill colors: shapes really differ.
    expect(new Set([...traces.values()].map((v) => v.join("|"))).size).toBe(6);
    createPickupTextures(scene);
    expect(created).toBe(6);
  });
  it("does not crash if a canvas texture cannot be allocated", () => {
    const scene: any = {
      textures: { exists: () => false, createCanvas: () => null },
    };
    expect(() => createPickupTextures(scene)).not.toThrow();
  });
});
