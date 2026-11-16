import { describe, it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01, type StageConfig } from "../src/data/stage";
const empty: StageConfig = {
  ...stage01,
  waves: [],
  boss: undefined,
  pickups: [],
};
const run = (m: FlightModel, seconds: number, fire = false, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) m.update(1 / fps, 0, 0, fire);
};
describe("combat increment", () => {
  it.each([30, 60, 120])(
    "normal center continuous fire clears actual Stage01 at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      let sawBoss = false,
        sawEnemyBullet = false,
        sawDouble = false;
      for (let i = 0; i < 76 * fps; i++) {
        m.update(1 / fps, 0, 0, true);
        sawBoss ||= !!m.boss?.active;
        sawEnemyBullet ||= m.enemyBullets.some((b) => b.active);
        sawDouble ||= m.weaponTime > 0;
      }
      expect(sawBoss && sawEnemyBullet && sawDouble).toBe(true);
      expect(m.mode).toBe("won");
      expect(m.bossDefeated).toBe(true);
      expect(m.time).toBeGreaterThan(60);
      expect(m.time).toBeLessThan(75);
      expect(m.score).toBeGreaterThanOrEqual(2500);
      expect(m.hp).toBeGreaterThan(0);
      console.log(
        `Stage01 ${fps}fps: won at ${m.time.toFixed(2)}s, hp=${m.hp}, score=${m.score}`,
      );
    },
  );
  it("turret holds, fires and exits; weave shifts sideways; pools stay bounded", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        {
          at: 0,
          x: 60,
          speed: 100,
          hp: 2,
          points: 100,
          behavior: "turret",
          fireEvery: 0.5,
        },
        { at: 0, x: 280, speed: 100, hp: 2, points: 100, behavior: "weave" },
      ],
    });
    m.start();
    run(m, 3);
    expect(m.enemies[0].y).toBeGreaterThanOrEqual(150);
    expect(m.enemies[0].y).toBeLessThan(153);
    expect(m.enemies[1].x).not.toBe(280);
    expect(m.enemyBullets.some((b) => b.active)).toBe(true);
    run(m, 13);
    expect(m.enemies.some((e) => e.active)).toBe(false);
    expect(m.enemyBullets.some((b) => b.active)).toBe(false);
    expect(m.enemyBullets.length).toBeLessThan(12);
  });
  it("enemy bullet damage respects invulnerability and removes hit bullets", () => {
    const m = new FlightModel(empty);
    m.start();
    for (let i = 0; i < 3; i++)
      m.enemyBullets.push({
        id: i,
        x: 180,
        y: 540,
        vx: 0,
        vy: 0,
        active: true,
      });
    m.update(0);
    expect(m.hp).toBe(2);
    expect(m.enemyBullets.every((b) => !b.active)).toBe(true);
    m.enemyBullets.push({ id: 4, x: 180, y: 540, vx: 0, vy: 0, active: true });
    m.update(0.05);
    expect(m.hp).toBe(2);
  });
  it("pickup heals at most to cap and double shot expires without modifying save", () => {
    const m = new FlightModel(empty);
    m.start();
    m.hp = 2;
    m.pickups.push({ id: 1, x: 180, y: 540, kind: "heal", active: true });
    m.update(0);
    expect(m.hp).toBe(3);
    m.update(0);
    expect(m.hp).toBe(3);
    m.pickups.push({ id: 2, x: 180, y: 540, kind: "double", active: true });
    m.update(0);
    expect(m.weaponTime).toBe(15);
    m.update(0, 0, 0, true);
    expect(m.bullets.filter((b) => b.active)).toHaveLength(2);
    expect(m.bullets.map((b) => b.x)).toEqual([172, 188]);
    run(m, 16);
    expect(m.weaponTime).toBe(0);
  });
  it("enemy death drops exactly one pickup and boss score is awarded once", () => {
    const m = new FlightModel({
      ...empty,
      boss: { at: 0, hp: 1, fireEvery: 9, bulletSpeed: 100, points: 500 },
    });
    m.start();
    m.enemies.push({
      id: 1,
      x: 50,
      y: 200,
      speed: 0,
      hp: 1,
      points: 100,
      drop: "double",
      active: true,
    });
    m.bullets.push({ id: 2, x: 50, y: 200, active: true });
    m.update(0);
    expect(m.pickups).toHaveLength(1);
    m.boss!.y = 100;
    m.bullets.push(
      { id: 3, x: 180, y: 100, active: true },
      { id: 4, x: 180, y: 100, active: true },
    );
    m.update(0);
    expect(m.mode).toBe("won");
    expect(m.score).toBe(600);
    m.update(0.05);
    expect(m.score).toBe(600);
  });
  it("surviving without defeating boss times out instead of winning", () => {
    const m = new FlightModel({
      ...empty,
      duration: 2,
      boss: { at: 0, hp: 20, fireEvery: 99, bulletSpeed: 10, points: 500 },
    });
    m.start();
    run(m, 3);
    expect(m.mode).toBe("lost");
    expect(m.lostReason).toBe("timeout");
    expect(m.time).toBe(2);
  });
  it("pause and ten restarts clear every new transient state", () => {
    const m = new FlightModel(stage01);
    m.start();
    run(m, 60, true);
    m.pause();
    const frozen = JSON.stringify({
      time: m.time,
      boss: m.boss,
      enemyBullets: m.enemyBullets,
      pickups: m.pickups,
    });
    run(m, 5, true);
    expect(
      JSON.stringify({
        time: m.time,
        boss: m.boss,
        enemyBullets: m.enemyBullets,
        pickups: m.pickups,
      }),
    ).toBe(frozen);
    for (let i = 0; i < 10; i++) {
      m.start();
      expect(m.enemyBullets).toHaveLength(0);
      expect(m.pickups).toHaveLength(0);
      expect(m.boss).toBeNull();
      expect(m.bossDefeated).toBe(false);
      expect(m.weaponTime).toBe(0);
      expect(m.lostReason).toBeNull();
      run(m, 1, true);
    }
    expect(m.hp).toBe(3);
    expect(m.score).toBe(0);
  });
});
