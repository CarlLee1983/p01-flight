import { touchDeliveryBudget } from "./touch-delivery-budget";
import { it, expect } from "vitest";
import timing from "./fixtures/touch-dispatch-timing.json";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { advanceFrame } from "../src/game/frame-step";
import { chooseTouchTarget } from "./touch-policy";
/** Empirical timing stress replay, NOT restoration of the CI game's full state.
 * Each profile retains the trace's changed/no-op delivery and observation gaps;
 * the normal FlightModel generates its own enemies, aiming, damage and pickups.
 * Timing classes cycle for a complete run because the bounded CI trace covers
 * only the late shore segment. This does not claim pixel-identical browser replay. */
function runRoute(
  fps: number,
  profile: keyof typeof timing,
  shoreBomb = true,
  retainPeak = true,
) {
  const m = new FlightModel(stage01);
  m.start();
  let target = 180,
    next = 0,
    index = 0,
    budget = 0.2;
  let pending:
    | { at: number; x: number; gap: number; lag: number; changed: boolean }
    | undefined;
  let phase = "wait",
    shore: (typeof m.enemies)[number] | undefined,
    returnStarted = 0,
    returnTime = 0,
    shoreDestroyed = false,
    bossBomb = false;
  for (let frame = 0; frame < 175 * fps && m.mode === "playing"; frame++) {
    if (m.time >= 140 && !bossBomb) {
      bossBomb = m.useBomb();
    }
    if (!shoreBomb && m.time >= 146 && m.bombs > 0) m.useBomb();
    if (m.time >= 70 && phase === "wait") {
      shore = m.enemies.find(
        (e) =>
          e.active && e.behavior === "groundBattery" && (e.telegraph ?? 0) > 0,
      );
      if (shore) phase = "attack";
    }
    if (phase === "attack" && !shore!.active) {
      shoreDestroyed = shore!.hp <= 0;
      if (shoreBomb) expect(m.useBomb()).toBe(true);
      phase = "back";
      returnStarted = m.time;
    }
    if (phase === "back" && Math.abs(m.player.x - 180) < 12) {
      phase = "done";
      returnTime = m.time - returnStarted;
    }
    if (phase === "back" && m.time - returnStarted > 8) break;
    if (pending && m.time >= pending.at) {
      target = pending.x;
      next = m.time + pending.gap;
      budget = retainPeak
        ? touchDeliveryBudget(budget, pending.changed, pending.lag)
        : Math.min(0.3, Math.max(0.2, pending.lag * 1.25));
      pending = undefined;
    }
    if (!pending && m.time >= next) {
      const choice = chooseTouchTarget(
        {
          player: m.player,
          hostileProjectiles: m.enemyBullets.filter((b) => b.active),
        },
        target,
        budget,
        phase === "attack" ? shore!.x : phase === "back" ? 180 : undefined,
      );
      const changed = Math.abs(choice - target) > 1;
      const choices = timing[profile].filter((r) => r.changed === changed);
      const t = choices[index++ % choices.length];
      pending = {
        at: m.time + t.lag,
        x: choice,
        gap: t.gap,
        lag: t.lag,
        changed,
      };
    }
    advanceFrame(m, 1 / fps, 0, 0, true, false, { x: target, y: 540 });
  }
  return {
    phase,
    returnTime,
    shoreDestroyed,
    mode: m.mode,
    hp: m.hp,
    bombs: m.bombs,
    time: m.time,
  };
}
it.each(
  [10, 30, 60, 120].flatMap((fps) =>
    (["ab36", "ddc81"] as const).map((profile) => ({ fps, profile })),
  ),
)("normal-health shore bomb route $fps FPS / $profile", ({ fps, profile }) => {
  const r = runRoute(fps, profile);
  console.log({ fps, profile, ...r });
  expect(r.shoreDestroyed).toBe(true);
  expect(r.phase).toBe("done");
  expect(r.returnTime).toBeLessThanOrEqual(8);
  expect(r.mode).toBe("won");
  expect(r.bombs).toBe(0);
});
it("retains the old route failure under observed ab36 timing", () => {
  const r = runRoute(60, "ab36", false, false);
  expect(r.phase).toBe("back");
  expect(r.mode).toBe("lost");
  expect(r.bombs).toBe(2);
});
it("retains the resource-only route's later failure under observed ab36 timing", () => {
  const r = runRoute(30, "ab36", true, false);
  expect(r.phase).toBe("done");
  expect(r.returnTime).toBeLessThanOrEqual(8);
  expect(r.mode).toBe("lost");
  expect(r.bombs).toBe(1);
});
