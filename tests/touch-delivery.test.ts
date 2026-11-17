import { it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { advanceFrame } from "../src/game/frame-step";
import { chooseTouchTarget, touchClearance } from "./touch-policy";
import type { PilotSnapshot } from "./keyboard-policy";
/** Frozen pre-fix driver reproducer, not a production option. */
function immediateOnly(s: PilotSnapshot, previous: number) {
  const x = s.player.x,
    clamp = (v: number) => Math.max(18, Math.min(342, v));
  const center = clamp(x + Math.max(-72, Math.min(72, 180 - x)));
  if (touchClearance(s, x) >= 32)
    return Math.abs(180 - x) > 48 && touchClearance(s, center) >= 48
      ? center
      : x;
  let best = x,
    score = -Infinity;
  for (const t of [
    ...new Set(
      [x, previous, x - 24, x + 24, x - 48, x + 48, x - 72, x + 72].map(clamp),
    ),
  ]) {
    const n =
      Math.min(60, touchClearance(s, t)) +
      (Math.abs(t - previous) < 1 ? 4 : 0) -
      Math.abs(t - x) * 0.015;
    if (n > score) {
      score = n;
      best = t;
    }
  }
  return best;
}
function route(
  latency: number,
  offset: number,
  old = false,
  fps = 60,
  jitter = false,
) {
  const m = new FlightModel(stage01);
  m.start();
  let target = 180,
    next = offset,
    pending: { at: number; x: number } | undefined;
  let b1 = false,
    b2 = false,
    hp = 3,
    sample = 0;
  const hits: number[] = [];
  for (let frame = 0; frame < 175 * fps && m.mode === "playing"; frame++) {
    if (m.time >= 140 && !b1) b1 = m.useBomb();
    if (m.time >= 146 && !b2) b2 = m.useBomb();
    if (pending && m.time >= pending.at) {
      target = pending.x;
      pending = undefined;
      next = m.time + 0.03;
    }
    if (!pending && m.time >= next) {
      const s = {
        player: { ...m.player },
        hostileProjectiles: m.enemyBullets.filter((b) => b.active),
      };
      pending = {
        at: m.time + (jitter ? [0.05, 0.2, 0.1, 0.15][sample++ % 4] : latency),
        x: old ? immediateOnly(s, target) : chooseTouchTarget(s, target),
      };
    }
    advanceFrame(m, 1 / fps, 0, 0, true, false, { x: target, y: 540 });
    if (m.hp < hp) hits.push(Number(m.time.toFixed(2)));
    hp = m.hp;
  }
  return { mode: m.mode, time: m.time, hp: m.hp, bombs: m.bombs, hits };
}
it("reproduces pre-fix stale-command defeat without modifying gameplay", () => {
  const old = route(0.2, 0, true);
  expect(old.mode).toBe("lost");
  expect(old.time).toBeLessThan(50);
  expect(old.hits.slice(0, 2)).toEqual([15.8, 17.45]);
});
it.each(
  [0, 0.05, 0.1, 0.15, 0.2].flatMap((latency) =>
    [0, 0.013, 0.027].map((offset) => ({ latency, offset })),
  ),
)("delayed touch latency=$latency phase=$offset", ({ latency, offset }) => {
  const result = route(latency, offset);
  console.log("delayed touch", { latency, offset, ...result });
  expect(result.mode).toBe("won");
  expect(result.hp).toBeGreaterThan(0);
  expect(result.bombs).toBe(0);
});
it.each([10, 30, 120])("variable50–200ms delivery at %iFPS", (fps) => {
  const result = route(0.2, 0.013, false, fps, true);
  console.log("jittered delivery", { fps, ...result });
  expect(result.mode).toBe("won");
  expect(result.bombs).toBe(0);
});
