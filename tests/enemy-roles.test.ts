import { describe, expect, it } from "vitest";
import { stage01, type Behavior } from "../src/data/stage";
import { FlightModel } from "../src/game/model";
import { fastAttackAngles } from "../src/game/enemy-patterns";
function isolated(behavior: Behavior) {
  const m = new FlightModel({
    ...stage01,
    boss: undefined,
    pickups: [],
    waves: [
      {
        at: 0,
        x: 60,
        spawnY: behavior === "hookWing" ? -24 : 100,
        speed: behavior === "hookWing" ? 210 : 225,
        hp: 100,
        points: 80,
        behavior,
        direction: 1,
        firstFireDelay: 0.6,
        fireEvery: 0.75,
      },
    ],
  });
  m.start();
  m.invincible = 20; // Isolated outgoing/kinematic audit, not survival evidence.
  return m;
}
it("substitutes exactly six of each role without adding aircraft", () => {
  expect(
    stage01.waves.filter((w) => w.behavior === "brakeRaider"),
  ).toHaveLength(6);
  expect(stage01.waves.filter((w) => w.behavior === "hookWing")).toHaveLength(
    6,
  );
  expect(stage01.waves.filter((w) => w.points === 80)).toHaveLength(312);
});
describe.each([30, 60, 120])("new role contracts %i FPS", (fps) => {
  it("raider brakes, locks its twin aim, then exits with only two volleys", () => {
    const m = isolated("brakeRaider");
    while (!m.enemies[0]?.telegraph) m.update(1 / fps);
    const e = m.enemies[0];
    expect(e.y).toBe(145);
    const angles = [...e.attackAngles!];
    expect(angles[1] - angles[0]).toBeCloseTo(0.36);
    const start = m.time;
    while (m.emittedEnemyShots === 0) m.update(1 / fps, -1);
    expect(m.time - start).toBeGreaterThan(0.5);
    expect(e.y).toBe(145);
    const shots = m.enemyBullets.filter((b) => b.active);
    expect(shots).toHaveLength(2);
    shots.forEach((b, i) => {
      expect(b.muzzleX).toBeCloseTo(e.x + (i === 0 ? -9 : 9));
      expect(b.muzzleY).toBeCloseTo(e.y + 20);
    });
    shots.forEach((b, i) =>
      expect(Math.atan2(b.vx, b.vy)).toBeCloseTo(angles[i]),
    );
    while (m.time < 4) m.update(1 / fps);
    expect(e.y).toBeGreaterThan(600);
    expect(e.shotsFired).toBe(2);
    expect(m.emittedEnemyShots).toBe(4);
  });
  it("hook banks inward then outward and alternates mirror volleys", () => {
    const m = isolated("hookWing");
    while (!m.emittedEnemyShots) m.update(1 / fps);
    const e = m.enemies[0],
      firstX = e.x;
    expect(firstX).toBeGreaterThan(100);
    const shots = m.enemyBullets.filter((b) => b.active);
    expect(shots).toHaveLength(2);
    shots.forEach((b, i) => {
      expect(b.muzzleX).toBeCloseTo(e.x + (i === 0 ? -9 : 9));
      expect(b.muzzleY).toBeCloseTo(e.y + 20);
    });
    shots.forEach((b, i) =>
      expect(Math.atan2(b.vx, b.vy)).toBeCloseTo(
        fastAttackAngles("hookWing", 0, 1)[i],
      ),
    );
    while (m.time < 2.5) m.update(1 / fps);
    expect(e.x).toBeLessThan(firstX);
    expect(e.shotsFired).toBe(2);
    expect(m.emittedEnemyShots).toBe(4);
    expect(fastAttackAngles("hookWing", 1, 1).every((a) => a < 0)).toBe(true);
    expect(fastAttackAngles("hookWing", 0, -1).every((a) => a < 0)).toBe(true);
  });
  it("full-stage new roles preserve outgoing density against original roles", () => {
    const legacy = {
      ...stage01,
      waves: stage01.waves.map((w) => ({
        ...w,
        speed: w.behavior === "hookWing" ? 225 : w.speed,
        behavior:
          w.behavior === "brakeRaider"
            ? w.at < 80
              ? "straight"
              : "weave"
            : w.behavior === "hookWing"
              ? "straight"
              : w.behavior,
      })),
    };
    const counts = [];
    for (const stage of [legacy, stage01]) {
      const m = new FlightModel(stage);
      m.start();
      m.invincible = 200;
      for (let i = 0; i < 121 * fps; i++) m.update(1 / fps);
      counts.push(m.emittedEnemyShots);
      expect(m.enteredAir).toBe(405);
    }
    console.log("new-role outgoing audit", {
      fps,
      legacy: counts[0],
      current: counts[1],
    });
    expect(counts[1]).toBeGreaterThanOrEqual(counts[0]);
    expect(counts[1]).toBeLessThanOrEqual(counts[0] + 24);
  });
});

it("recycled enemies cannot inherit a previous braking phase", () => {
  const wave = stage01.waves.find((w) => w.behavior === "brakeRaider")!;
  const m = new FlightModel({
    ...stage01,
    boss: undefined,
    pickups: [],
    waves: [
      { ...wave, at: 0 },
      { ...wave, at: 1 },
    ],
  });
  m.start();
  m.update(0.05);
  const first = m.enemies[0];
  first.brakeElapsed = 8;
  first.shotsFired = 2;
  first.attackAngles = [1, 2];
  first.active = false;
  while (m.time < 1.01) m.update(0.05);
  expect(m.enemies).toHaveLength(1);
  expect(first.brakeElapsed).toBeUndefined();
  expect(first.shotsFired).toBe(0);
  expect(first.attackAngles).toEqual([]);
  expect(first.y).toBeLessThan(145);
});
