import { expect, it } from "vitest";
import { stage01, type StageConfig } from "../src/data/stage";
import { FlightModel } from "../src/game/model";

const baseline: StageConfig = {
  ...stage01,
  enemyBurstShots: 1,
  boss: { ...stage01.boss!, burstShots: 1 },
};
function ordinaryAudit(stage: StageConfig, fps: number, fire: boolean) {
  const m = new FlightModel(stage);
  m.start();
  m.invincible = 200; // Count outgoing fire, not a survivability simulation.
  let peak = 0;
  for (let i = 0; i < 125 * fps; i++) {
    m.update(1 / fps, 0, 0, fire);
    peak = Math.max(peak, m.enemyBullets.filter((b) => b.active).length);
  }
  return { shots: m.emittedEnemyShots, peak };
}
it.each([30, 60, 120])(
  "ordinary fire approximately doubles over the same 0–125s at %i FPS",
  (fps) => {
    for (const fire of [false, true]) {
      const before = ordinaryAudit(baseline, fps, fire);
      const after = ordinaryAudit(stage01, fps, fire);
      console.log("ordinary burst audit", {
        fps,
        fire,
        before,
        after,
        ratio: after.shots / before.shots,
      });
      // A tail cancels when its aircraft is destroyed or exits. No ghost shots.
      expect(after.shots / before.shots).toBeGreaterThanOrEqual(1.8);
      expect(after.shots / before.shots).toBeLessThanOrEqual(2);
      expect(after.peak).toBeLessThanOrEqual(40);
    }
  },
);
it.each([30, 60, 120])(
  "all Boss phases emit exactly four times per eight complete attacks at %i FPS",
  (fps) => {
    for (const phase of [1, 2, 3]) {
      const totals: number[] = [];
      const times: number[] = [];
      for (const burstShots of [1, 4]) {
        const m = new FlightModel({
          ...stage01,
          duration: 60,
          waves: [],
          pickups: [],
          boss: { ...stage01.boss!, at: 0, burstShots },
        });
        m.start();
        m.invincible = 100;
        m.update(1 / fps);
        m.boss!.hp =
          m.boss!.maxHp * (phase === 1 ? 1 : phase === 2 ? 0.5 : 0.2);
        let finalShot = 0;
        while (m.time < 40) {
          m.update(1 / fps);
          if (m.boss!.attackCycle === 8 && !finalShot) finalShot = m.time;
          if (finalShot && m.time >= finalShot + 0.4) break;
        }
        expect(m.boss!.attackCycle).toBe(8);
        totals.push(m.emittedBossShots);
        times.push(m.time);
      }
      console.log("Boss burst audit", { fps, phase, totals, times });
      expect(times[1]).toBeCloseTo(times[0]);
      expect(totals[1]).toBe(totals[0] * 4);
    }
  },
);
it("burst tails freeze on pause and cancel on bomb, emitter destruction, restart", () => {
  const stage: StageConfig = {
    ...stage01,
    waves: [
      {
        at: 0,
        x: 180,
        spawnY: 140,
        speed: 0,
        hp: 3,
        points: 1,
        fireEvery: 1,
        firstFireDelay: 0.6,
      },
    ],
    pickups: [],
    boss: undefined,
  };
  for (const cancel of ["bomb", "destroy", "restart"] as const) {
    const m = new FlightModel(stage);
    m.start();
    m.invincible = 100;
    while (m.emittedEnemyShots === 0) m.update(1 / 60);
    expect(m.emittedEnemyShots).toBe(1);
    m.mode = "paused";
    for (let i = 0; i < 60; i++) m.update(1 / 60);
    expect(m.emittedEnemyShots).toBe(1);
    m.mode = "playing";
    if (cancel === "bomb") m.useBomb();
    if (cancel === "destroy") m.enemies[0].active = false;
    if (cancel === "restart") m.start();
    for (let i = 0; i < 15; i++) m.update(1 / 60);
    expect(m.emittedEnemyShots).toBe(cancel === "restart" ? 0 : 1);
  }
});
it("a recycled enemy slot cannot inherit a previous emitter's pending tail", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [
      {
        at: 0,
        x: 180,
        spawnY: 140,
        speed: 0,
        hp: 3,
        points: 1,
        fireEvery: 1,
        firstFireDelay: 0.6,
      },
      { at: 0.7, x: 40, speed: 100, hp: 1, points: 2 },
    ],
    pickups: [],
    boss: undefined,
  });
  m.start();
  m.invincible = 100;
  while (!m.emittedEnemyShots) m.update(1 / 60);
  m.enemies[0].active = false;
  for (let i = 0; i < 20; i++) m.update(1 / 60);
  expect(m.enemies[0].points).toBe(2);
  expect(m.emittedEnemyShots).toBe(1);
});
it("Boss phase change and destroyed side cannons cancel unfinished trains", () => {
  for (const change of ["phase", "cannons"] as const) {
    const m = new FlightModel({
      ...stage01,
      waves: [],
      pickups: [],
      boss: { ...stage01.boss!, at: 0 },
    });
    m.start();
    m.invincible = 100;
    while (!m.emittedBossShots) m.update(1 / 60);
    expect(m.emittedBossShots).toBe(2);
    if (change === "phase") m.boss!.hp = 100;
    else m.boss!.cannons.forEach((c) => (c.active = false));
    for (let i = 0; i < 30; i++) m.update(1 / 60);
    expect(m.emittedBossShots).toBe(2);
  }
});
