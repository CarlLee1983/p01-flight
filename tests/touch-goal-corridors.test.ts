import { expect, it } from "vitest";
import snapshots from "./fixtures/touch-goal-corridors.json";
import { chooseTouchTarget, delayedTouchClearance } from "./touch-policy";
it.each(snapshots)(
  "uses a safe intermediate destination from CI trace at $time seconds",
  (s) => {
    const longTarget = Math.min(180, s.player.x + 72);
    expect(
      delayedTouchClearance(s, s.player.x, s.previousTarget, s.latency),
    ).toBeGreaterThanOrEqual(32);
    expect(
      delayedTouchClearance(s, longTarget, s.previousTarget, s.latency),
    ).toBeLessThan(48);
    const chosen = chooseTouchTarget(s, s.previousTarget, s.latency, 180);
    expect(chosen).toBeGreaterThan(s.player.x);
    expect(
      delayedTouchClearance(s, chosen, s.previousTarget, s.latency),
    ).toBeGreaterThanOrEqual(48);
  },
);
