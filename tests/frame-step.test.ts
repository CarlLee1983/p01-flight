import { describe, it, expect } from "vitest";
import { advanceFrame } from "../src/game/frame-step";
import { FlightModel } from "../src/game/model";
const make = () =>
  new FlightModel({
    id: "test",
    title: "frame",
    duration: 200,
    width: 360,
    height: 640,
    waves: [],
  });
describe("bounded rendering catch-up", () => {
  it.each([10, 15, 20, 30, 60, 120])(
    "does not lose simulation time at %i rendered FPS",
    (fps) => {
      const m = make();
      m.start();
      for (let i = 0; i < 10 * fps; i++)
        advanceFrame(m, 1 / fps, 0, 0, true, false);
      expect(m.time).toBeCloseTo(10, 6);
      expect(m.shots).toBeGreaterThan(60);
    },
  );
  it("bounds long stalls, invalid delta, and each collision step", () => {
    const m = make();
    m.start();
    expect(advanceFrame(m, 20, 1, 0, false, false)).toBe(15);
    expect(m.time).toBeCloseTo(0.25);
    expect(m.player.x).toBeCloseTo(240);
    for (const bad of [-1, NaN, Infinity])
      expect(advanceFrame(m, bad, 1, 0, false, false)).toBe(0);
    expect(m.time).toBeCloseTo(0.25);
  });
  it("preserves pause and touch speed cap instead of teleporting", () => {
    const m = make();
    m.start();
    m.pause();
    advanceFrame(m, 0.2, 0, 0, true, false, { x: 300, y: 540 });
    expect(m.time).toBe(0);
    expect(m.player.x).toBe(180);
    m.pause();
    advanceFrame(m, 0.1, 0, 0, true, false, { x: 300, y: 540 });
    expect(m.player.x).toBeCloseTo(204);
    expect(m.time).toBeCloseTo(0.1);
  });
});
