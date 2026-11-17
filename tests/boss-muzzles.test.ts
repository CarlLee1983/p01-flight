import { expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import { bossMuzzle } from "../src/game/boss-muzzles";
import { stage01 } from "../src/data/stage";

it.each([30, 60, 120])(
  "Boss first shots and moving tails leave the visible side barrels at %i FPS",
  (fps) => {
    const m = new FlightModel({
      ...stage01,
      waves: [],
      pickups: [],
      boss: { ...stage01.boss!, at: 0 },
    });
    m.start();
    m.invincible = 30;
    const dt = 1 / fps;
    while (!m.boss?.attackWarning) m.update(dt);
    const boss = m.boss!;
    const angles = [...boss.attackAngles];
    let previous = 0;
    for (let frame = 0; frame < fps * 2 && m.emittedBossShots < 8; frame++) {
      m.update(dt);
      if (m.emittedBossShots === previous) continue;
      const fresh = m.enemyBullets.filter((b) => b.active).slice(-2);
      expect(fresh).toHaveLength(2);
      fresh.forEach((bullet, i) => {
        const muzzle = bossMuzzle(boss, i, 2);
        expect(muzzle.x).toBeCloseTo(boss.x + (i === 0 ? -68 : 68));
        expect(muzzle.y).toBeCloseTo(boss.y + 42);
        expect(bullet.x - bullet.vx * dt).toBeCloseTo(muzzle.x);
        expect(bullet.y - bullet.vy * dt).toBeCloseTo(muzzle.y);
        expect(Math.atan2(bullet.vx, bullet.vy)).toBeCloseTo(angles[i]);
      });
      previous = m.emittedBossShots;
    }
    expect(m.emittedBossShots).toBe(8);
    boss.cannons[0].active = false;
    expect(bossMuzzle(boss, 0, 5).active).toBe(false);
    expect(bossMuzzle(boss, 4, 5).active).toBe(true);
    expect(bossMuzzle(boss, 2, 5)).toMatchObject({
      x: boss.x,
      y: boss.y + 28,
      active: true,
    });
  },
);
