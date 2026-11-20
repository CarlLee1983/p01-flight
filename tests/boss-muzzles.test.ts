import { expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import { bossMuzzle, bossSideTargets } from "../src/game/boss-muzzles";
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
    const target = bossSideTargets(m.player.x, m.player.y, boss.attackCycle);
    let previous = 0;
    for (let frame = 0; frame < fps * 2 && m.emittedBossShots < 8; frame++) {
      m.update(dt);
      if (m.emittedBossShots === previous) continue;
      const fresh = m.enemyBullets.filter((b) => b.active).slice(-2);
      expect(fresh).toHaveLength(2);
      fresh.forEach((bullet, i) => {
        const muzzle = bossMuzzle(boss, i, 2);
        const part = boss.cannons[i],
          a = part.aimAngle ?? 0;
        expect(muzzle.x).toBeCloseTo(part.x + Math.sin(a) * 22);
        expect(muzzle.y).toBeCloseTo(part.y + Math.cos(a) * 22);
        expect(bullet.x - bullet.vx * dt).toBeCloseTo(muzzle.x);
        expect(bullet.y - bullet.vy * dt).toBeCloseTo(muzzle.y);
        expect(
          muzzle.x + (bullet.vx / bullet.vy) * (target.y - muzzle.y),
        ).toBeCloseTo(target.xs[i]);
      });
      previous = m.emittedBossShots;
    }
    expect(m.emittedBossShots).toBe(8);
    boss.cannons[0].active = false;
    expect(bossMuzzle(boss, 0, 5).active).toBe(false);
    expect(bossMuzzle(boss, 4, 5).active).toBe(true);
    const core = bossMuzzle(boss, 2, 5);
    expect(core.x).toBeCloseTo(boss.x - Math.sin(boss.roll ?? 0) * 28);
    expect(core.y).toBeCloseTo(boss.y + Math.cos(boss.roll ?? 0) * 28);
  },
);
