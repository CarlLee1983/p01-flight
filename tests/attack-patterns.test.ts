import { describe, expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01, type StageConfig } from "../src/data/stage";

const empty: StageConfig = {
  ...stage01,
  waves: [],
  pickups: [],
  boss: undefined,
};
function advance(m: FlightModel, seconds: number, fps: number, dx = 0) {
  for (let i = 0; i < Math.round(seconds * fps); i++) m.update(1 / fps, dx);
}

describe.each([30, 60, 120])("readable attack contracts at %i FPS", (fps) => {
  it("dive locks during warning, allowing a normal-speed side dodge before commitment", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        { at: 0, x: 100, speed: 140, hp: 3, points: 1, behavior: "dive" },
      ],
    });
    m.start();
    advance(m, 1.1, fps);
    const enemy = m.enemies[0];
    expect(enemy.telegraph).toBeGreaterThan(0.5);
    const angle = enemy.diveAngle!;
    const x = enemy.x,
      y = enemy.y;
    expect(enemy.aimAngle).toBe(angle);
    advance(m, 0.4, fps, 1);
    expect(m.player.x).toBeCloseTo(276);
    expect(enemy.x).toBe(x);
    expect(enemy.y).toBe(y);
    expect(enemy.diveAngle).toBe(angle);
    advance(m, 0.5, fps);
    expect(enemy.telegraph).toBe(0);
    expect(enemy.x).toBeGreaterThan(x);
    expect(enemy.diveAngle).toBe(angle);
    // It committed to the old line, not the player's position at charge-end.
    expect(
      Math.abs(angle - Math.atan2(m.player.x - x, m.player.y - y)),
    ).toBeGreaterThan(0.1);
  });

  it("heavy previews the exact alternating three-ray fan without increasing shot count", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        {
          at: 0,
          x: 180,
          speed: 100,
          hp: 9,
          points: 1,
          behavior: "heavy",
          fireEvery: 2,
        },
      ],
    });
    m.start();
    const previews: number[][] = [];
    let previousShots = 0;
    for (let i = 0; i < 7 * fps; i++) {
      m.update(1 / fps);
      const enemy = m.enemies[0];
      if (
        enemy.telegraph! > 0 &&
        enemy.attackAngles?.length &&
        previews.length === previousShots
      )
        previews.push([...enemy.attackAngles]);
      if ((enemy.shotsFired ?? 0) > previousShots) {
        const latest = m.enemyBullets.filter((b) => b.active).slice(-3);
        expect(latest).toHaveLength(3);
        latest.forEach((bullet, j) =>
          expect(Math.atan2(bullet.vx, bullet.vy)).toBeCloseTo(
            previews[previousShots][j],
          ),
        );
        previousShots++;
      }
    }
    expect(previousShots).toBeGreaterThanOrEqual(2);
    expect(previews[0][1]).toBeCloseTo(-0.14);
    expect(previews[1][1]).toBeCloseTo(0.14);
  });

  it.each([1, 2, 3] as const)(
    "Boss phase %i locks a forecast and removes broken-side rays",
    (phase) => {
      const m = new FlightModel({
        ...empty,
        boss: {
          at: 0,
          hp: 400,
          sideCannonHp: 24,
          fireEvery: 2.7,
          bulletSpeed: 140,
          points: 3000,
        },
      });
      m.start();
      advance(m, 0.1, fps);
      const boss = m.boss!;
      // Isolated phase fixture. The ordinary unmodified victory routes live in frame-route/stage-expanded.
      boss.hp = phase === 1 ? 400 : phase === 2 ? 200 : 100;
      for (let i = 0; i < 5 * fps && boss.attackWarning <= 0; i++)
        m.update(1 / fps);
      expect(boss.attackWarning).toBeGreaterThan(0);
      const planned = [...boss.attackAngles];
      expect(planned.length).toBe(phase === 1 ? 2 : phase === 2 ? 5 : 3);
      const plans = boss.attackPlan!.map((ray) => ({ ...ray }));
      const cycle = boss.attackCycle;
      const warning = boss.attackWarning;
      expect(warning).toBeGreaterThan(0.6);
      boss.cannons[0].active = false;
      // Moving after lock must not retarget the advertised rays.
      advance(m, 0.2, fps, 1);
      expect(boss.attackAngles).toEqual(planned);
      m.pause();
      const frozen = boss.attackWarning;
      advance(m, 1, fps);
      expect(boss.attackWarning).toBe(frozen);
      m.pause();
      for (let i = 0; i < 3 * fps && boss.attackCycle === cycle; i++)
        m.update(1 / fps);
      expect(boss.attackCycle).toBe(cycle + 1);
      const shots = m.enemyBullets.filter((b) => b.active);
      const surviving = plans.filter((ray) => ray.mount !== 0);
      expect(shots).toHaveLength(surviving.length);
      shots.forEach((bullet, j) => {
        const ray = surviving[j];
        if (ray.target)
          expect(
            bullet.x + (bullet.vx / bullet.vy) * (ray.target.y - bullet.y),
          ).toBeCloseTo(ray.target.x);
        else expect(Math.atan2(bullet.vx, bullet.vy)).toBeCloseTo(ray.angle);
      });
      expect(boss.attackWarning).toBe(0);
      expect(boss.attackAngles).toEqual([]);
      m.start();
      expect(m.boss).toBeNull();
      expect(m.enemyBullets.some((b) => b.active)).toBe(false);
    },
  );
});
