import { it, expect } from "vitest";
import { createStage03 } from "../src/data/stage03";
import { FlightModel } from "../src/game/model";
import { advanceFrame } from "../src/game/frame-step";
import { VisibleHullTracker } from "./visible-hull-policy";
import { chooseAction, type Steering } from "./keyboard-policy";
import { bossAimGoal } from "./boss-counterplay";
for (const [seed, fps] of [
  [1, 60],
  [42, 60],
  [2026, 60],
  [42, 30],
])
  it(`same-policy Stage03 observations seed ${seed} at ${fps} FPS`, () => {
    const m = new FlightModel(createStage03(seed));
    m.start();
    const tracker = new VisibleHullTracker();
    let held: Steering = 0,
      next = 0,
      bombs = 0,
      damage = 0,
      travel = 0,
      phase = 0;
    const phases: Record<
      string,
      { seconds: number; volleys: number; movement: number }
    > = {};
    for (let frame = 0; frame < 205 * fps && m.mode === "playing"; frame++) {
      if ((m.time >= 161 && bombs === 0) || (m.time >= 168 && bombs === 1))
        if (m.useBomb()) bombs++;
      if (m.time >= next) {
        held = chooseAction(
          {
            player: m.player,
            hostileProjectiles: [
              ...m.enemyBullets.filter((b) => b.active),
              ...tracker.observe(
                m.time,
                m.enemies.filter((e) => e.active),
              ),
            ],
          },
          held,
          bossAimGoal(m.boss, m.player.x),
        );
        next = m.time + 0.08;
      }
      const before = {
        hp: m.hp,
        x: m.player.x,
        bx: m.boss?.x ?? 180,
        by: m.boss?.y ?? 0,
        cycle: m.boss?.attackCycle ?? 0,
      };
      advanceFrame(m, 1 / fps, held, 0, true, false);
      damage += Math.max(0, before.hp - m.hp);
      travel += Math.abs(m.player.x - before.x);
      if (m.boss?.active) {
        phase = m.boss.phase;
        const p = (phases[phase] ??= { seconds: 0, volleys: 0, movement: 0 });
        p.seconds += 1 / fps;
        p.volleys += Math.max(0, m.boss.attackCycle - before.cycle);
        p.movement += Math.hypot(m.boss.x - before.bx, m.boss.y - before.by);
      }
    }
    console.log(
      "BOSS_ROUTE_OBSERVATION " +
        JSON.stringify({
          seed,
          fps,
          mode: m.mode,
          hp: m.hp,
          damage,
          time: m.time,
          travel,
          phases,
        }),
    );
    expect(m.mode).toBe("won");
    expect(m.bossDefeated).toBe(true);
  });
it("stationary firing is not a normal observed-input survival route", () => {
  const m = new FlightModel(createStage03(42));
  m.start();
  for (let f = 0; f < 205 * 60 && m.mode === "playing"; f++)
    advanceFrame(m, 1 / 60, 0, 0, true, false);
  console.log(
    "STATIONARY_ROUTE_OBSERVATION " +
      JSON.stringify({
        mode: m.mode,
        time: m.time,
        hp: m.hp,
        bossReached: !!m.boss,
      }),
  );
  expect(m.mode).toBe("lost");
});
