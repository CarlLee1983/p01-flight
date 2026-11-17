import { expect, it } from "vitest";
import {
  drawImpact,
  IMPACT_DURATION,
  IMPACT_MAX_PRIMITIVES,
  type ImpactGraphics,
} from "../src/game/impact-art";
function recorder() {
  const calls: unknown[][] = [];
  const g = {} as ImpactGraphics;
  for (const method of [
    "fillStyle",
    "fillEllipse",
    "fillTriangle",
    "lineStyle",
    "lineBetween",
  ] as const)
    g[method] = (...args: number[]) => {
      calls.push([method, ...args]);
    };
  return { g, calls };
}
it("uses stable seed variation, not frame-to-frame randomness", () => {
  const a = recorder(),
    b = recorder(),
    c = recorder();
  drawImpact(a.g, 80, 80, 0.12, "destroy", 1, 37);
  drawImpact(b.g, 80, 80, 0.12, "destroy", 1, 37);
  drawImpact(c.g, 80, 80, 0.12, "destroy", 1, 38);
  expect(a.calls).toEqual(b.calls);
  expect(a.calls).not.toEqual(c.calls);
});
it("has bounded finite geometry over every frame and supported duration", () => {
  for (const kind of ["hit", "destroy", "boss"] as const)
    for (const duration of [IMPACT_DURATION[kind], 0.4])
      for (let frame = 0; frame <= 120; frame++) {
        const { g, calls } = recorder(),
          count = drawImpact(
            g,
            100,
            100,
            (frame / 120) * duration,
            kind,
            1,
            3,
            duration,
          );
        expect(count).toBeLessThanOrEqual(IMPACT_MAX_PRIMITIVES);
        expect(
          calls.filter((c) => !String(c[0]).includes("Style")),
        ).toHaveLength(count);
        for (const call of calls)
          for (const v of call.slice(1)) expect(Number.isFinite(v)).toBe(true);
      }
});
it("burns through distinct white ignition, flame shards and cooling smoke stages", () => {
  const first = recorder(),
    middle = recorder(),
    last = recorder();
  drawImpact(first.g, 0, 0, 0.01);
  drawImpact(middle.g, 0, 0, 0.18);
  drawImpact(last.g, 0, 0, 0.4);
  expect(
    first.calls.some((c) => c[0] === "fillStyle" && c[1] === 0xffffee),
  ).toBe(true);
  expect(middle.calls.some((c) => c[0] === "fillTriangle")).toBe(true);
  expect(last.calls.some((c) => c[0] === "fillEllipse")).toBe(true);
  expect(last.calls.some((c) => c[0] === "fillTriangle")).toBe(false);
});
it("expires exactly and refuses invalid ages/durations without drawing", () => {
  for (const kind of ["hit", "destroy", "boss"] as const)
    for (const age of [-1, NaN, Infinity, IMPACT_DURATION[kind]]) {
      const { g, calls } = recorder();
      expect(drawImpact(g, 0, 0, age, kind)).toBe(0);
      expect(calls).toEqual([]);
    }
});

it("mid-blast is layered volume, with at most two detached triangular tongues", () => {
  const { g, calls } = recorder();
  const count = drawImpact(g, 100, 100, 0.18, "destroy", 1, 37);
  expect(
    calls.filter((c) => c[0] === "fillEllipse").length,
  ).toBeGreaterThanOrEqual(15);
  expect(calls.filter((c) => c[0] === "fillTriangle")).toHaveLength(2);
  expect(count).toBe(IMPACT_MAX_PRIMITIVES);
});
