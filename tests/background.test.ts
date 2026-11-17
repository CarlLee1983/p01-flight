import { describe, expect, it } from "vitest";
import {
  CoastalBackground,
  harborArtState,
  harborExitY,
  COAST_SCROLL,
  coastalScrollState,
  coastalAreaState,
  COAST_AREAS as CURRENT_AREAS,
  type CoastalAreaConfig,
  COAST_LANDMARKS,
  coastalLandmarkY,
  type CoastalLandmarkConfig,
} from "../src/game/background";

import { STAGE01_SCENERY } from "../src/data/scenery";
// Keep the old short-stage fixture to verify backward-compatible caller configs.
const COAST_AREAS: readonly CoastalAreaConfig[] = [
  ...CURRENT_AREAS.slice(0, 4),
  { id: "harbor-exit", label: "突破港區", at: 50, fade: 3, scenery: "exit" },
  { id: "approach", label: "補給水域", at: 56, fade: 4, scenery: "approach" },
  { id: "command", label: "指揮艦區", at: 70, fade: 5, scenery: "command" },
];
const SHORT_TIMELINE = {
  ...STAGE01_SCENERY,
  artworkBlocks: [],
  exitAt: 53,
  duration: 115,
  areas: COAST_AREAS,
};
const shortExitY = (time: number) => harborExitY(time, 720, 53);
describe("continuous coastal background", () => {
  it("configures the extended stage and keeps exit opaque through 170 seconds", () => {
    const object: any = new Proxy({}, { get: () => () => object });
    const scene: any = {
      add: { graphics: () => object, image: () => object },
      textures: {
        exists: () => true,
        get: () => ({ getSourceImage: () => ({ width: 720, height: 1440 }) }),
      },
    };
    const background = new CoastalBackground(scene);
    expect(CURRENT_AREAS.map((a) => a.at)).toEqual([
      0, 15, 32, 40, 50, 56, 62, 78, 96, 102, 121, 125,
    ]);
    for (const time of [62, 78, 96, 102, 108, 121, 125, 170]) {
      background.update(time);
      const d = background.diagnostics();
      expect(d.distance).toBe(time * 32);
      expect(d.exitY).toBe((time - 108) * 32 - 720);
      expect(d.exitAt).toBe(108);
    }
    expect(background.diagnostics().exitWorldY).toBe(-56);
    expect(background.diagnostics().exitAlpha).toBe(1);
    background.update(60);
    expect(background.diagnostics().artworkBlocks[0].y).toBe(-720);
    background.update(78);
    expect(background.diagnostics().artworkBlocks[0].y).toBe(-144);
    background.update(95);
    expect(background.diagnostics().artworkBlocks[0].y).toBe(400);
    background.update(103);
    expect(background.diagnostics().artworkBlocks[0].y).toBe(656);
    expect(harborExitY(108)).toBe(-720);
    expect(harborExitY(125)).toBe(-176);
  });
  it("overlaps original port artwork without uncovered top or bottom and reuses coordinates", () => {
    for (const height of [640, 720, 768, 1024]) {
      const state = harborArtState(0, height);
      const positions = state.y;
      for (let frame = 0; frame < 10000; frame++) {
        expect(harborArtState((frame * 32) / 60, height, state)).toBe(state);
        expect(state.y).toBe(positions);
        for (const edge of [0, 640]) {
          const coverage = state.y.reduce((sum, top) => {
            const local = edge - top;
            return (
              sum + Math.max(0, Math.min(1, local / 90, (height - local) / 90))
            );
          }, 0);
          expect(coverage).toBeCloseTo(1);
        }
      }
    }
    expect(harborArtState(1280, 720)).toEqual(harborArtState(1280, 720));
  });
  it("uses four reused original-art images and suppresses legacy port blocks", () => {
    let created = 0,
      drawn = 0;
    const graphics: any[] = [];
    const make = (graphic = false) => {
      created++;
      const data: any = { alpha: 1 };
      const object: any = new Proxy(data, {
        get(target, key) {
          if (key === "alpha") return target.alpha;
          return (...args: any[]) => {
            if (key === "setAlpha") target.alpha = args[0];
            if (
              String(key).startsWith("fill") ||
              String(key).startsWith("line") ||
              String(key).startsWith("stroke")
            )
              drawn++;
            return object;
          };
        },
      });
      if (graphic) graphics.push(object);
      return object;
    };
    const scene: any = {
      add: { graphics: () => make(true), image: () => make() },
      textures: {
        exists: (key: string) => key !== "harbor-exit",
        get: () => ({ getSourceImage: () => ({ width: 720, height: 1440 }) }),
      },
    };
    const background = new CoastalBackground(
      scene,
      COAST_AREAS,
      undefined,
      SHORT_TIMELINE,
    );
    expect(created).toBe(27);
    background.update(44);
    expect(background.diagnostics().harborArtImages).toBe(4);
    expect(background.diagnostics().harborArtAlpha).toBe(1);
    // Last two geometry Graphics before shade are the legacy channel/arena.
    expect(graphics.at(-2).alpha).toBe(0);
    expect(graphics.at(-3).alpha).toBe(0);
    const initialDrawn = drawn;
    for (let i = 0; i < 10000; i++) background.update(i / 60);
    expect(created).toBe(27);
    expect(drawn).toBe(initialDrawn);
    // Supply and boss approach must not erase the map or jump back to a new strip.
    for (const time of [50, 56, 64, 69, 70, 75]) {
      background.update(time);
      const state = background.diagnostics();
      expect(state.harborArtReady).toBe(true);
      expect(state.harborArtAlpha).toBe(1);
      expect(state.harborArtWorldDistance).toBe(time * 32);
      expect(state.harborArtY).toEqual(harborArtState(time * 32, 720).y);
      background.update(time + 0.01);
      const next = background.diagnostics();
      expect(
        next.harborArtWorldDistance - state.harborArtWorldDistance,
      ).toBeCloseTo(0.32);
      for (let i = 0; i < 4; i++) {
        expect(
          (next.harborArtY[i] - state.harborArtY[i] + state.harborArtStride) %
            state.harborArtStride,
        ).toBeCloseTo(0.32);
      }
      expect(next.harborArtAlpha).toBe(1);
    }
    // Reset to menu preserves the initial offshore opening, not a late-stage tile.
    background.update(0);
    expect(background.diagnostics().harborArtAlpha).toBe(0);
    expect(background.diagnostics().harborArtWorldDistance).toBe(0);
    background.update(44);
    const paused = background.diagnostics().harborArtY;
    background.update(44);
    expect(background.diagnostics().harborArtY).toEqual(paused);
  });
  it("keeps exit art and open-water continuation bounded across a full stage", () => {
    let created = 0;
    const object: any = new Proxy({}, { get: () => () => object });
    const make = () => {
      created++;
      return object;
    };
    const scene: any = {
      add: { graphics: make, image: make },
      textures: {
        exists: () => true,
        get: () => ({ getSourceImage: () => ({ width: 720, height: 1440 }) }),
      },
    };
    const background = new CoastalBackground(
      scene,
      COAST_AREAS,
      undefined,
      SHORT_TIMELINE,
    );
    expect(created).toBe(28);
    expect(background.diagnostics().exitReady).toBe(true);
    expect(background.diagnostics().exitSeaImages).toBe(0);
    expect(background.diagnostics().exitOpaqueInterior).toBe(true);
    background.update(53);
    expect(background.diagnostics().exitAlpha).toBe(0);
    background.update(64);
    expect(background.diagnostics().exitAlpha).toBe(1);
    expect(background.diagnostics().exitY).toBe(-368);
    background.update(115);
    expect(background.diagnostics().exitWorldY).toBe(-56);
    expect(background.diagnostics().exitWorldHeight).toBe(2040);
    expect(background.diagnostics().exitAlpha).toBe(1);
    for (let frame = 0; frame < 20000; frame++) background.update(frame / 60);
    expect(created).toBe(28);
    background.update(70);
    const paused = background.diagnostics().exitY;
    background.update(70);
    expect(background.diagnostics().exitY).toBe(paused);
    background.update(0);
    expect(background.diagnostics().exitAlpha).toBe(0);
  });
  it.each(["harbor-exit", "harbor-refinery"])(
    "precomposes opaque <=4096px %s without stretching water samples",
    (texture) => {
      const textures = new Set([texture]);
      const draws: any[][] = [],
        gradients: number[][] = [],
        sizes: number[][] = [];
      const object: any = new Proxy({}, { get: () => () => object });
      const context: any = {
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
        drawImage: (...args: any[]) => draws.push(args),
        fillRect: () => {},
        createLinearGradient: (...args: number[]) => {
          gradients.push(args);
          return { addColorStop: () => {} };
        },
      };
      const scene: any = {
        add: { graphics: () => object, image: () => object },
        textures: {
          exists: (key: string) => textures.has(key),
          get: () => ({ getSourceImage: () => ({ width: 720, height: 1440 }) }),
          createCanvas: (key: string, width: number, height: number) => {
            sizes.push([width, height]);
            textures.add(key);
            return { getContext: () => context, refresh: () => {} };
          },
        },
      };
      const background = new CoastalBackground(
        scene,
        COAST_AREAS,
        undefined,
        texture === "harbor-exit" ? SHORT_TIMELINE : STAGE01_SCENERY,
      );
      expect(sizes).toEqual([[720, 4080]]);
      // Every sampled strip is copied at natural pixel scale before the whole world
      // is uniformly scaled to logical width 360. Only its south edge gets a mask.
      for (const draw of draws) {
        expect(draw[3]).toBe(draw[7]);
        expect(draw[4]).toBe(draw[8]);
      }
      expect(gradients).toEqual([[0, 3900, 0, 4080]]);
      expect(context.globalAlpha).toBe(1);
      expect(context.globalCompositeOperation).toBe("source-over");
      background.update(115);
      if (texture === "harbor-exit")
        expect(background.diagnostics().exitWorldY).toBe(-56);
      else {
        for (const time of [88, 95, 100, 105, 108, 112, 123]) {
          background.update(time);
          const block = background.diagnostics().artworkBlocks[0];
          expect(block.worldY).toBe((time - 60) * 32 - 2040);
          expect(block.worldY).toBeLessThan(0);
          expect(block.worldY + block.worldHeight - 90).toBeGreaterThan(640);
          expect(block.opaqueNorth).toBe(true);
        }
      }
    },
  );
  it("introduces the exit warehouses spatially, not as a whole-screen fade", () => {
    expect(shortExitY(53)).toBe(-720);
    expect(shortExitY(64)).toBe(-368);
    expect(shortExitY(70)).toBe(-176);
    expect(shortExitY(75)).toBe(-16);
    for (const time of [50, 53, 56, 64, 69, 70, 75, 95, 115]) {
      expect(shortExitY(time + 1) - shortExitY(time)).toBe(32);
      expect(shortExitY(time)).toBe(shortExitY(time));
    }
  });
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
    expect(COAST_AREAS.map((a) => a.at)).toEqual([0, 15, 32, 40, 50, 56, 70]);
    expect(coastalAreaState(14, COAST_AREAS).area).toBe("offshore");
    expect(coastalAreaState(20, COAST_AREAS).area).toBe("channel");
    expect(coastalAreaState(39, COAST_AREAS).area).toBe("harbor");
    expect(coastalAreaState(44, COAST_AREAS).area).toBe("elite-basin");
    expect(coastalAreaState(53, COAST_AREAS).area).toBe("harbor-exit");
    expect(coastalAreaState(62, COAST_AREAS).area).toBe("approach");
    expect(coastalAreaState(76, COAST_AREAS).area).toBe("command");
    for (const area of COAST_AREAS.slice(1)) {
      expect(coastalAreaState(area.at, COAST_AREAS).transition).toBe(0);
      expect(
        coastalAreaState(area.at + area.fade / 2, COAST_AREAS).transition,
      ).toBeCloseTo(0.5);
      expect(
        coastalAreaState(area.at + area.fade, COAST_AREAS).transition,
      ).toBe(1);
      expect(
        coastalScrollState(area.at + 0.01).distance -
          coastalScrollState(area.at - 0.01).distance,
      ).toBeCloseTo(0.64);
    }
    expect(coastalAreaState(NaN, COAST_AREAS)).toEqual(
      coastalAreaState(0, COAST_AREAS),
    );
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
      textures: {
        exists: (key: string) =>
          key !== "harbor-battlefield" &&
          key !== "harbor-exit" &&
          key !== "harbor-refinery",
      },
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
        "beginPath",
        "moveTo",
        "lineTo",
        "closePath",
        "fillPath",
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
      textures: {
        exists: (key: string) =>
          key !== "harbor-battlefield" &&
          key !== "harbor-exit" &&
          key !== "harbor-refinery",
      },
    };
    const landmarks: CoastalLandmarkConfig[] = [
      { id: "single-crane", kind: "crane", side: "right", distance: 900 },
    ];
    const background = new CoastalBackground(scene, COAST_AREAS, landmarks);
    background.update(20);
    let visual = background.diagnostics();
    expect(visual.passages.find((p) => p.kind === "channel")?.alpha).toBe(1);
    expect(visual.coastOpacity).toBeCloseTo(0.14);
    background.update(44);
    visual = background.diagnostics();
    expect(visual.passages.find((p) => p.kind === "arena")?.alpha).toBe(1);
    expect(visual.passages.find((p) => p.kind === "arena")?.y).toBe(-52);
    expect(visual.coastOpacity).toBeCloseTo(0.025);
    background.update(45);
    expect(
      background.diagnostics().passages.find((p) => p.kind === "arena")?.y,
    ).toBe(-20);
    background.update(61);
    visual = background.diagnostics();
    expect(visual.coastOpacity).toBe(0);
    expect(visual.passages.every((p) => p.alpha === 0)).toBe(true);
    expect(visual.layerAlphas).toEqual([0.2, 0, 0]);
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
        "beginPath",
        "moveTo",
        "lineTo",
        "closePath",
        "fillPath",
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
      textures: {
        exists: (key: string) =>
          key !== "harbor-battlefield" &&
          key !== "harbor-exit" &&
          key !== "harbor-refinery",
      },
    };
    const background = new CoastalBackground(
      scene,
      COAST_AREAS,
      undefined,
      SHORT_TIMELINE,
    );
    expect(objects).toHaveLength(23);
    for (let i = 0; i < 1000; i++) background.update(i / 60);
    expect(objects).toHaveLength(23);
    background.update(42);
    const frozen = JSON.stringify(objects.map(({ x, y }) => ({ x, y })));
    background.update(42);
    expect(JSON.stringify(objects.map(({ x, y }) => ({ x, y })))).toBe(frozen);
    expect(background.diagnostics().coastImages).toBe(4);
    expect(background.diagnostics().coastReady).toBe(true);
    background.update(72.5);
    expect(background.diagnostics().area).toBe("command");
    expect(background.diagnostics().sceneryWeights).toEqual([
      0, 0, 0, 0, 0, 0.5, 0.5,
    ]);
    expect(background.diagnostics().sceneryObjects).toBe(13);
    const paused = background.diagnostics();
    background.update(72.5);
    expect(background.diagnostics()).toEqual(paused);
    background.update(0);
    expect(background.diagnostics().sceneryWeights).toEqual([
      1, 0, 0, 0, 0, 0, 0,
    ]);
  });
});
