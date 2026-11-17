import { expect, it } from "vitest";
import { stage01 } from "../src/data/stage";
import { fastAttackAngles } from "../src/game/enemy-patterns";
import { FlightModel } from "../src/game/model";

it("fast roles have distinct locked V, alternating diagonal and direction-dependent rake", () => {
  expect(fastAttackAngles("straight", 0)).toEqual([-0.18, 0.18]);
  expect(fastAttackAngles("weave", 0).every((a) => a < 0)).toBe(true);
  expect(fastAttackAngles("weave", 1).every((a) => a > 0)).toBe(true);
  expect(fastAttackAngles("cross", 0, 1).every((a) => a > 0)).toBe(true);
  expect(fastAttackAngles("cross", 0, -1).every((a) => a < 0)).toBe(true);
});
it.each([30, 60, 120])(
  "225px/s aircraft cannot overtake their own delayed tails at %i FPS",
  (fps) => {
    const m = new FlightModel({
      ...stage01,
      waves: [
        {
          at: 0,
          x: 180,
          spawnY: 100,
          speed: 225,
          hp: 9,
          points: 1,
          behavior: "straight",
          firstFireDelay: 0.6,
          fireEvery: 2,
        },
      ],
      boss: undefined,
      pickups: [],
    });
    m.start();
    m.invincible = 10;
    let planned: number[] = [];
    while (!m.emittedEnemyShots) {
      m.update(1 / fps);
      if (m.enemies[0]?.attackAngles?.length)
        planned = [...m.enemies[0].attackAngles];
    }
    expect(m.emittedEnemyShots).toBe(2);
    const pair = m.enemyBullets.filter((b) => b.active);
    expect(pair).toHaveLength(2);
    expect(planned).toEqual([-0.18, 0.18]);
    pair.forEach((b, i) =>
      expect(Math.atan2(b.vx, b.vy)).toBeCloseTo(planned[i]),
    );
    let minimum = Infinity;
    for (let i = 0; i < fps / 2; i++) {
      minimum = Math.min(
        minimum,
        Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y),
      );
      m.update(1 / fps);
    }
    expect(minimum).toBeGreaterThan(17); // 10px visual diameter; no merged pair.
    expect(m.emittedEnemyShots).toBe(2);
  },
);
