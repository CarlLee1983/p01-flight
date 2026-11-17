import { describe, expect, it } from "vitest";
import {
  chooseAction,
  clearance,
  type PilotSnapshot,
  type Steering,
} from "./keyboard-policy";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { advanceFrame } from "../src/game/frame-step";
const snapshot = (
  x: number,
  bullets: PilotSnapshot["hostileProjectiles"],
): PilotSnapshot => ({ player: { x, y: 540 }, hostileProjectiles: bullets });
describe("swept keyboard policy", () => {
  it("does not return to center across a bullet when standing is safe", () => {
    const s = snapshot(90, [{ x: 138, y: 512, vx: 0, vy: 140 }]);
    expect(clearance(s, 0)).toBeGreaterThan(32);
    expect(clearance(s, 1)).toBeLessThan(2);
    expect(chooseAction(s)).toBe(0);
  });
  it("detects a diagonal bullet crossing the movement path", () => {
    const s = snapshot(90, [{ x: 162, y: 512, vx: -120, vy: 140 }]);
    expect(clearance(s, 1)).toBeLessThan(2);
    expect(chooseAction(s)).not.toBe(1);
  });
  it("retains an existing side on symmetric danger rather than chattering", () => {
    const s = snapshot(180, [{ x: 180, y: 510, vx: 0, vy: 140 }]);
    expect(chooseAction(s, -1)).toBe(-1);
    expect(chooseAction(s, 1)).toBe(1);
  });
  it("releases an outward key at either boundary", () => {
    expect(chooseAction(snapshot(18, []), -1)).toBe(1);
    expect(chooseAction(snapshot(342, []), 1)).toBe(-1);
  });
});
// Full model routes use original health, two original bombs and continuous fire.
// Sampling jitter approximates delayed key decisions; this is not browser evidence.
it.each(
  [10, 12, 13, 15, 18, 20, 24, 30, 60, 120].flatMap((fps) =>
    [false, true].map((jitter) => ({ fps, jitter })),
  ),
)("full stage at $fps FPS, jitter=$jitter", ({ fps, jitter }) => {
  const m = new FlightModel(stage01);
  m.start();
  let held: Steering = 0,
    nextSample = 0,
    sample = 0;
  let firstBomb = false,
    secondBomb = false;
  for (let frame = 0; frame < fps * 175 && m.mode === "playing"; frame++) {
    if (m.time >= 140 && !firstBomb) firstBomb = m.useBomb();
    if (m.time >= 146 && !secondBomb) secondBomb = m.useBomb();
    if (m.time >= nextSample) {
      held = chooseAction(
        snapshot(
          m.player.x,
          m.enemyBullets.filter((b) => b.active),
        ),
        held,
      );
      nextSample =
        m.time + (jitter ? [0.05, 0.12, 0.08, 0.18, 0.1][sample++ % 5] : 0.1);
    }
    advanceFrame(m, 1 / fps, held, 0, true, false);
  }
  console.log("swept keyboard route", {
    fps,
    jitter,
    mode: m.mode,
    hp: m.hp,
    time: m.time,
    bombs: m.bombs,
  });
  expect(m.mode).toBe("won");
});
