import { describe, expect, it } from "vitest";
import {
  CoastalBackground,
  COAST_SCROLL,
  coastalScrollState,
} from "../src/game/background";

describe("continuous coastal background", () => {
  it("moves at 32 pixels per second and returns to its overlap cycle", () => {
    expect(coastalScrollState(2).offset).toBe(64);
    expect(
      coastalScrollState(COAST_SCROLL.stride / COAST_SCROLL.speed).offset,
    ).toBe(0);
    expect(coastalScrollState(2).currentOffset).toBe(120);
    expect(coastalScrollState(2).cloudOffset).toBe(170);
  });
  it("covers top and bottom with overlapping tiles at every cycle position", () => {
    for (let frame = 0; frame < 1000; frame++) {
      const y = coastalScrollState(frame / 60).coastY;
      expect(y[0]).toBeLessThanOrEqual(0);
      for (const edge of [0, 640]) {
        const coverage = y.reduce((sum, top) => {
          const local = edge - top;
          return sum + Math.max(0, Math.min(1, local / 90, (540 - local) / 90));
        }, 0);
        expect(coverage).toBeCloseTo(1);
      }
      expect(y[3] + COAST_SCROLL.imageHeight).toBeGreaterThanOrEqual(640);
      expect(y[0] + COAST_SCROLL.imageHeight - y[1]).toBeCloseTo(90);
      expect(y[1] + COAST_SCROLL.imageHeight - y[2]).toBeCloseTo(90);
    }
  });
  it("same simulation time stays frozen during pause; invalid times are safe", () => {
    expect(coastalScrollState(42)).toEqual(coastalScrollState(42));
    expect(coastalScrollState(-1)).toEqual(coastalScrollState(0));
    expect(coastalScrollState(NaN)).toEqual(coastalScrollState(0));
  });
  it("reuses objects and positions, including after wrapped time", () => {
    const objects: any[] = [];
    const object = () => {
      const o: any = { x: 0, y: 0 };
      for (const name of [
        "setDepth",
        "fillStyle",
        "fillRect",
        "lineStyle",
        "lineBetween",
        "fillEllipse",
        "setOrigin",
        "setDisplaySize",
        "setAlpha",
      ])
        o[name] = () => o;
      o.setPosition = (x: number, y: number) => {
        o.x = x;
        o.y = y;
        return o;
      };
      objects.push(o);
      return o;
    };
    const scene: any = {
      add: { graphics: object, image: object },
      textures: { exists: () => true },
    };
    const background = new CoastalBackground(scene);
    expect(objects).toHaveLength(10);
    for (let i = 0; i < 1000; i++) background.update(i / 60);
    expect(objects).toHaveLength(10);
    background.update(42);
    const frozen = JSON.stringify(objects.map(({ x, y }) => ({ x, y })));
    background.update(42);
    expect(JSON.stringify(objects.map(({ x, y }) => ({ x, y })))).toBe(frozen);
    expect(background.diagnostics().coastImages).toBe(4);
    expect(background.diagnostics().coastReady).toBe(true);
  });
});
