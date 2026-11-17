import { expect, it } from "vitest";
import {
  BOSS_BODY,
  hostileStyle,
  groundMuzzle,
  turnToward,
} from "../src/game/hostile-visuals";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
it("three silhouettes follow source, not a random palette", () => {
  expect(hostileStyle(false, "straight")).toBe("needle");
  expect(hostileStyle(false, "groundBattery")).toBe("shell");
  expect(hostileStyle(true)).toBe("plasma");
  expect(turnToward(0, 1, 1 / 60)).toBeCloseTo(0.05);
  expect(turnToward(Math.PI - 0.01, -Math.PI + 0.01, 1 / 60)).toBeCloseTo(
    Math.PI + 0.01,
  );
});
it.each([30, 60, 120])(
  "turret tracks then locks through two shots at %i FPS",
  (fps) => {
    const m = new FlightModel({
      ...stage01,
      waves: [
        {
          at: 0,
          x: 80,
          spawnY: 130,
          speed: 0,
          hp: 100,
          points: 0,
          behavior: "groundBattery",
          fireEvery: 4,
          firstFireDelay: 2,
        },
      ],
      boss: undefined,
      pickups: [],
    });
    m.start();
    let seen = false;
    let locked = 0;
    let first = 0;
    let count = 0;
    for (let i = 0; i < 3.5 * fps; i++) {
      const prior = m.emittedEnemyShots;
      m.update(1 / fps, seen ? -1 : 0);
      const e = m.enemies[0];
      if (!seen && (e.telegraph ?? 0) > 0) {
        seen = true;
        locked = e.turretAngle!;
        expect(locked).toBeGreaterThan(0.1);
      }
      if ((e.telegraph ?? 0) > 0 || (first && m.time - first < 0.34))
        expect(e.turretAngle).toBeCloseTo(locked);
      if (m.emittedEnemyShots > prior) {
        if (!first) first = m.time;
        const b = m.enemyBullets.find((b) => b.active && b.bornAt === m.time)!;
        const muzzle = groundMuzzle(e, locked);
        expect(b.muzzleX).toBeCloseTo(muzzle.x);
        expect(b.muzzleY).toBeCloseTo(muzzle.y);
        expect(Math.atan2(b.vx, b.vy)).toBeCloseTo(locked);
        expect(b.visual).toBe("shell");
        count++;
      }
    }
    expect(seen).toBe(true);
    expect(count).toBe(2);
    m.start();
    expect(m.enemyBullets).toEqual([]);
  },
);

it("settled Boss outline clears the HUD throughout its bank", () => {
  for (const deg of [-BOSS_BODY.bankDegrees, 0, BOSS_BODY.bankDegrees]) {
    const r = (deg * Math.PI) / 180;
    expect(
      105 -
        (Math.abs(Math.cos(r)) * BOSS_BODY.height) / 2 -
        (Math.abs(Math.sin(r)) * BOSS_BODY.width) / 2,
    ).toBeGreaterThan(72);
  }
});
