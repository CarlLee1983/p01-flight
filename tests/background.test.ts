import { describe, expect, it } from "vitest";
import {
  CoastalBackground,
  COAST_SCROLL,
  coastalScrollState,
  coastalAreaState,
  COAST_AREAS,
  type CoastalAreaConfig,
  COAST_LANDMARKS,
  coastalLandmarkY,
  type CoastalLandmarkConfig,
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
  it("progresses through configured areas without resetting scroll distance", () => {
    expect(COAST_AREAS.map((a) => a.at)).toEqual([0, 15, 32, 56, 70]);
    expect(coastalAreaState(14).area).toBe("offshore");
    expect(coastalAreaState(20).area).toBe("channel");
    expect(coastalAreaState(40).area).toBe("harbor");
    expect(coastalAreaState(62).area).toBe("approach");
    expect(coastalAreaState(76).area).toBe("command");
    for (const area of COAST_AREAS.slice(1)) {
      expect(coastalAreaState(area.at).transition).toBe(0);
      expect(coastalAreaState(area.at + area.fade / 2).transition).toBeCloseTo(
        0.5,
      );
      expect(coastalAreaState(area.at + area.fade).transition).toBe(1);
      expect(
        coastalScrollState(area.at + 0.01).distance -
          coastalScrollState(area.at - 0.01).distance,
      ).toBeCloseTo(0.64);
    }
    expect(coastalAreaState(NaN)).toEqual(coastalAreaState(0));
  });
  it("allows the same scenery components to be retimed, reordered and repeated", () => {
    const areas: CoastalAreaConfig[] = [
      {
        id: "dock-start",
        label: "碼頭起飛",
        at: 0,
        fade: 0,
        scenery: "harbor",
      },
      { id: "open-sea", label: "外海", at: 10, fade: 2, scenery: "offshore" },
      {
        id: "return-dock",
        label: "返回港區",
        at: 20,
        fade: 4,
        scenery: "harbor",
      },
      { id: "flagship", label: "警戒區", at: 40, fade: 3, scenery: "command" },
      { id: "exit", label: "離港航道", at: 60, fade: 2, scenery: "channel" },
    ];
    expect(coastalAreaState(0, areas).area).toBe("dock-start");
    expect(coastalAreaState(11, areas).transition).toBeCloseTo(0.5);
    expect(coastalAreaState(24, areas).area).toBe("return-dock");
    expect(coastalAreaState(61, areas).areaLabel).toBe("離港航道");
    expect(coastalAreaState(61, areas).transition).toBeCloseTo(0.5);
    const object: any = new Proxy({}, { get: () => () => object });
    const scene: any = {
      add: { graphics: () => object, image: () => object },
      textures: { exists: () => true },
    };
    const background = new CoastalBackground(scene, areas);
    expect(background.diagnostics().layerAlphas).toEqual([0, 1, 0]);
    background.update(11);
    expect(background.diagnostics().layerAlphas).toEqual([0.175, 0.5, 0]);
    background.update(45);
    expect(background.diagnostics().layerAlphas).toEqual([0, 0, 1]);
    background.update(62);
    expect(background.diagnostics().layerAlphas).toEqual([1, 0, 0]);
    expect(background.diagnostics().distance).toBe(62 * 32);
    background.update(0);
    expect(background.diagnostics().layerAlphas).toEqual([0, 1, 0]);
  });
  it("rejects invalid area ordering instead of silently resetting scenery", () => {
    expect(() => coastalAreaState(0, [])).toThrow(RangeError);
    expect(() => coastalAreaState(0, [{ ...COAST_AREAS[0], at: 2 }])).toThrow(
      RangeError,
    );
    expect(() =>
      coastalAreaState(0, [COAST_AREAS[0], { ...COAST_AREAS[1], fade: -1 }]),
    ).toThrow(RangeError);
    expect(() =>
      coastalAreaState(0, [COAST_AREAS[0], COAST_AREAS[2], COAST_AREAS[1]]),
    ).toThrow(RangeError);
  });
  it("places landmarks once in world space at the same 32px/s as terrain", () => {
    expect(new Set(COAST_LANDMARKS.map((l) => l.kind)).size).toBe(4);
    for (const landmark of COAST_LANDMARKS) {
      expect(coastalLandmarkY(landmark.distance, landmark)).toBe(0);
      expect(coastalLandmarkY(landmark.distance + 32, landmark)).toBe(32);
      // No modulo wrapping: a passed landmark never reappears lower in a tile cycle.
      expect(coastalLandmarkY(landmark.distance + 640, landmark)).toBe(640);
      expect(coastalLandmarkY(landmark.distance + 1280, landmark)).toBe(1280);
    }
  });
  it("supports custom one-off landmark placement without redraw or new objects per frame", () => {
    let created = 0,
      drawn = 0;
    const objects: any[] = [];
    const object = () => {
      const o: any = { x: 0, y: 0 };
      const chain = () => o;
      for (const method of [
        "setDepth",
        "setOrigin",
        "setDisplaySize",
        "setAlpha",
        "setVisible",
      ])
        o[method] = chain;
      for (const method of [
        "fillStyle",
        "fillRect",
        "lineStyle",
        "lineBetween",
        "fillEllipse",
        "strokeEllipse",
      ])
        o[method] = () => {
          drawn++;
          return o;
        };
      o.setPosition = (x: number, y: number) => {
        o.x = x;
        o.y = y;
        return o;
      };
      created++;
      objects.push(o);
      return o;
    };
    const scene: any = {
      add: { graphics: object, image: object },
      textures: { exists: () => true },
    };
    const landmarks: CoastalLandmarkConfig[] = [
      { id: "single-crane", kind: "crane", side: "right", distance: 900 },
    ];
    const background = new CoastalBackground(scene, COAST_AREAS, landmarks);
    const initialCount = created,
      initialDraws = drawn;
    const stateReference = (background as any).state;
    const positionsReference = stateReference.coastY;
    const areaReference = (background as any).areaState;
    for (let i = 0; i < 10000; i++) background.update(i / 60);
    expect((background as any).state).toBe(stateReference);
    expect((background as any).state.coastY).toBe(positionsReference);
    expect((background as any).areaState).toBe(areaReference);
    expect(created).toBe(initialCount);
    expect(drawn).toBe(initialDraws);
    background.update(40);
    expect(background.diagnostics().landmarks).toEqual([
      { id: "single-crane", kind: "crane", side: "right", x: 288, y: 380 },
    ]);
    const paused = background.diagnostics();
    background.update(40);
    expect(background.diagnostics()).toEqual(paused);
    background.update(0);
    expect(background.diagnostics().landmarks[0].y).toBe(-900);
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
        "strokeEllipse",
        "setVisible",
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
    expect(objects).toHaveLength(21);
    for (let i = 0; i < 1000; i++) background.update(i / 60);
    expect(objects).toHaveLength(21);
    background.update(42);
    const frozen = JSON.stringify(objects.map(({ x, y }) => ({ x, y })));
    background.update(42);
    expect(JSON.stringify(objects.map(({ x, y }) => ({ x, y })))).toBe(frozen);
    expect(background.diagnostics().coastImages).toBe(4);
    expect(background.diagnostics().coastReady).toBe(true);
    background.update(72.5);
    expect(background.diagnostics().area).toBe("command");
    expect(background.diagnostics().sceneryWeights).toEqual([
      0, 0, 0, 0.5, 0.5,
    ]);
    expect(background.diagnostics().sceneryObjects).toBe(11);
    const paused = background.diagnostics();
    background.update(72.5);
    expect(background.diagnostics()).toEqual(paused);
    background.update(0);
    expect(background.diagnostics().sceneryWeights).toEqual([1, 0, 0, 0, 0]);
  });
});
