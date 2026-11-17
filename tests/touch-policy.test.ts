import { expect, it } from "vitest";
import { chooseTouchTarget, touchClearance } from "./touch-policy";
import { clearance, type PilotSnapshot } from "./keyboard-policy";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { advanceFrame } from "../src/game/frame-step";
const snap = (
  x: number,
  bullets: PilotSnapshot["hostileProjectiles"],
): PilotSnapshot => ({ player: { x, y: 540 }, hostileProjectiles: bullets });
it("includes danger after arrival rather than assuming continuous keyboard movement", () => {
  const s = snap(180, [{ x: 196, y: 498, vx: 0, vy: 140 }]);
  expect(touchClearance(s, 196)).toBeLessThan(1);
  expect(clearance(s, 1)).toBeGreaterThan(25);
  expect(chooseTouchTarget(s)).not.toBe(196);
});
it("does not center through a crossing bullet", () => {
  const s = snap(90, [{ x: 138, y: 512, vx: 0, vy: 140 }]);
  expect(touchClearance(s, 162)).toBeLessThan(1);
  expect(chooseTouchTarget(s)).toBe(90);
});
it("clamps destinations and can leave either boundary", () => {
  expect(chooseTouchTarget(snap(18, []), 0)).toBeGreaterThan(18);
  expect(chooseTouchTarget(snap(342, []), 360)).toBeLessThan(342);
  expect(touchClearance(snap(18, []), -100)).toBe(Infinity);
});
it.each(
  [10, 12, 15, 20, 30, 60, 120].flatMap((fps) =>
    [false, true].map((jitter) => ({ fps, jitter })),
  ),
)("touch full route $fps FPS jitter=$jitter", ({ fps, jitter }) => {
  const m = new FlightModel(stage01);
  m.start();
  let target = 180,
    next = 0,
    samples = 0,
    first = false,
    second = false;
  let phase = "wait",
    shore: (typeof m.enemies)[number] | undefined;
  for (let frame = 0; frame < 175 * fps && m.mode === "playing"; frame++) {
    if (m.time >= 140 && !first) first = m.useBomb();
    if (m.time >= 146 && !second) second = m.useBomb();
    if (m.time >= 70 && phase === "wait") {
      shore = m.enemies.find(
        (e) =>
          e.active && e.behavior === "groundBattery" && (e.telegraph ?? 0) > 0,
      );
      if (shore) phase = "attack";
    }
    if (phase === "attack" && !shore?.active) phase = "back";
    if (phase === "back" && Math.abs(m.player.x - 180) < 12) phase = "done";
    if (m.time >= next) {
      target = chooseTouchTarget(
        snap(
          m.player.x,
          m.enemyBullets.filter((b) => b.active),
        ),
        target,
        0.2,
        phase === "attack" ? shore!.x : phase === "back" ? 180 : undefined,
      );
      next =
        m.time + (jitter ? [0.05, 0.12, 0.08, 0.18, 0.1][samples++ % 5] : 0.1);
    }
    advanceFrame(m, 1 / fps, 0, 0, true, false, { x: target, y: 540 });
  }
  console.log("touch model route", {
    fps,
    jitter,
    mode: m.mode,
    hp: m.hp,
    time: m.time,
    phase,
    bombs: m.bombs,
  });
  expect(m.mode).toBe("won");
  expect(phase).toBe("done");
  expect(m.bombs).toBe(0);
  expect(m.enteredAir).toBe(405);
});

it("waits rather than crossing a bullet to reach a requested goal, then resumes", () => {
  const dangerous = snap(64, [{ x: 100, y: 512, vx: 0, vy: 140 }]);
  expect(chooseTouchTarget(dangerous, 64, 0.2, 180)).toBe(64);
  expect(chooseTouchTarget(snap(64, []), 64, 0.2, 180)).toBe(136);
  expect(chooseTouchTarget(snap(136, []), 136, 0.2, 180)).toBe(180);
});
