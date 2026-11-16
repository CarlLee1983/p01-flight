import { describe, it, expect } from "vitest";
import { TouchInput } from "../src/game/touch-input";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
const empty = { ...stage01, waves: [], boss: undefined, pickups: [] };
describe("relative touch input", () => {
  it("begins at the player rather than jumping to the finger; converts CSS scale", () => {
    const input = new TouchInput();
    expect(input.begin(7, 40, 200, 180, 540, 0.5)).toBe(true);
    expect(input.target).toEqual({ x: 180, y: 540 });
    input.move(7, 60, 180);
    expect(input.target).toEqual({ x: 220, y: 500 });
    const sample = input.sample({ x: 180, y: 540 }, 1 / 60);
    expect(sample.fire).toBe(true);
    expect(Math.hypot(sample.next.x - 180, sample.next.y - 540)).toBeCloseTo(4);
  });
  it("rejects second fingers and stale move/end, retaining the captured pointer", () => {
    const input = new TouchInput();
    input.begin(7, 0, 0, 180, 540, 1);
    expect(input.begin(8, 100, 100, 180, 540, 1)).toBe(false);
    expect(input.move(8, 200, 200)).toBe(false);
    expect(input.end(8)).toBe(false);
    expect(input.pointerId).toBe(7);
    expect(input.target).toEqual({ x: 180, y: 540 });
    expect(input.end(7)).toBe(true);
    expect(input.active).toBe(false);
    expect(input.move(7, 50, 50)).toBe(false);
    expect(input.sample({ x: 180, y: 540 }, 1 / 60).fire).toBe(false);
    expect(input.begin(8, 0, 0, 180, 540, 1)).toBe(true);
  });
  it.each(["cancel", "reset", "resize"] as const)(
    "%s clears target, capture and firing",
    (method) => {
      const input = new TouchInput();
      input.begin(1, 0, 0, 180, 540, 1);
      input.move(1, 50, 50);
      input[method]();
      expect(input.pointerId).toBeNull();
      expect(input.target).toBeUndefined();
      expect(input.sample({ x: 180, y: 540 }, 0.05)).toEqual({
        dx: 0,
        dy: 0,
        fire: false,
        next: { x: 180, y: 540 },
      });
    },
  );
  it("clamps targets, supports independent CSS scales, and returns defensive copies", () => {
    const input = new TouchInput();
    input.begin(1, 0, 0, 180, 540, { x: 2, y: 0.5 });
    input.move(1, 20, -20);
    expect(input.target).toEqual({ x: 190, y: 500 });
    input.target!.x = 1000;
    expect(input.target!.x).toBe(190);
    input.move(1, 10000, -10000);
    expect(input.target).toEqual({ x: 342, y: 70 });
    input.move(1, -10000, 10000);
    expect(input.target).toEqual({ x: 18, y: 616 });
  });
  it("rejects invalid coordinates/scale and caps large frame deltas", () => {
    const input = new TouchInput();
    expect(input.begin(1, 0, 0, 180, 540, 0)).toBe(false);
    expect(input.begin(1, NaN, 0, 180, 540, 1)).toBe(false);
    input.begin(1, 0, 0, 180, 540, 1);
    expect(input.move(1, Infinity, 0)).toBe(false);
    input.move(1, 100, 0);
    expect(input.sample({ x: 180, y: 540 }, 1).next.x).toBe(192);
    expect(input.sample({ x: 180, y: 540 }, NaN).next.x).toBe(180);
  });
});
describe("model target integration", () => {
  it.each([30, 60, 120])(
    "small-distance target converges without overshoot at %i FPS",
    (fps) => {
      const input = new TouchInput(),
        m = new FlightModel(empty);
      m.start();
      input.begin(1, 0, 0, m.player.x, m.player.y, 1);
      input.move(1, 0.5, -0.25);
      for (let i = 0; i < fps; i++) {
        const frame = input.sample(m.player, 1 / fps);
        m.update(1 / fps, frame.dx, frame.dy, frame.fire, false, frame.target);
        expect(m.player.x).toBeLessThanOrEqual(180.5);
        expect(m.player.y).toBeGreaterThanOrEqual(539.75);
      }
      expect(m.player).toEqual({ x: 180.5, y: 539.75 });
      expect(m.shots).toBeGreaterThan(0);
      expect(m.time).toBeCloseTo(1);
    },
  );
  it("target movement never exceeds speed, honors focus, bounds, pause and collision", () => {
    const m = new FlightModel(empty);
    m.start();
    m.update(0.05, 0, 0, false, false, { x: 500, y: 540 });
    expect(m.player.x).toBe(192);
    m.update(0.05, 0, 0, false, true, { x: 500, y: 540 });
    expect(m.player.x).toBe(197);
    m.pause();
    m.update(0.05, 0, 0, false, false, { x: 300, y: 540 });
    expect(m.player.x).toBe(197);
    m.pause();
    m.enemies.push({
      id: 7,
      x: 197,
      y: 540,
      speed: 0,
      hp: 1,
      points: 10,
      active: true,
    });
    m.update(0, 0, 0, false, false, { x: 197, y: 540 });
    expect(m.hp).toBe(2);
    for (let i = 0; i < 100; i++)
      m.update(0.05, 0, 0, false, false, { x: 500, y: -100 });
    expect(m.player).toEqual({ x: 342, y: 70 });
  });
});
