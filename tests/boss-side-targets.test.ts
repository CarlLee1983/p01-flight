import { expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import { bossMuzzle, bossSideTargets } from "../src/game/boss-muzzles";
import { stage01 } from "../src/data/stage";

it("side targets alternate and keep a 96px gap even at screen edges", () => {
  for (const x of [18, 76, 180, 284, 342])
    for (const cycle of [0, 1]) {
      const t = bossSideTargets(x, 540, cycle);
      expect(t.xs[1] - t.xs[0]).toBe(96);
      expect(t.xs[0]).toBeGreaterThanOrEqual(28);
      expect(t.xs[1]).toBeLessThanOrEqual(332);
    }
  expect(bossSideTargets(180, 540, 0).xs).toEqual([180, 276]);
  expect(bossSideTargets(180, 540, 1).xs).toEqual([84, 180]);
});
it.each([30, 60, 120])(
  "locked side fire threatens standing still but leaves a normal-speed dodge at %i FPS",
  (fps) => {
    function trial(dodge: boolean) {
      const m = new FlightModel({
        ...stage01,
        waves: [],
        pickups: [],
        boss: { ...stage01.boss!, at: 0, fireEvery: 20 },
      });
      m.start();
      let frames = 0;
      while (!m.boss?.attackWarning && frames++ < 30 * fps) m.update(1 / fps);
      const boss = m.boss!;
      expect(boss.attackWarning).toBeGreaterThan(0.6);
      const target = bossSideTargets(m.player.x, m.player.y, boss.attackCycle);
      const locked = [...boss.attackAngles];
      locked.forEach((a, i) => {
        const muzzle = bossMuzzle(boss, i, 2);
        expect(muzzle.x + Math.tan(a) * (target.y - muzzle.y)).toBeCloseTo(
          target.xs[i],
        );
      });
      const initialShots = m.emittedBossShots;
      for (let frame = 0; frame < 5 * fps; frame++) {
        const dx =
          dodge && Math.abs(m.player.x - target.gapX) > 3
            ? Math.sign(target.gapX - m.player.x)
            : 0;
        m.update(1 / fps, dx);
        if (boss.attackWarning > 0) expect(boss.attackAngles).toEqual(locked);
      }
      expect(m.emittedBossShots - initialShots).toBe(8);
      return m.damageCount;
    }
    expect(trial(false)).toBeGreaterThan(0);
    expect(trial(true)).toBe(0);
  },
);
