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
    "normal centered fire and two bombs clear actual Stage01 at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      let sawBoss = false,
        sawEnemyBullet = false,
        sawDouble = false;
      let bomb1 = false,
        bomb2 = false;
      for (let i = 0; i < 116 * fps; i++) {
        if (!bomb1 && m.time >= 85) bomb1 = m.useBomb();
        if (!bomb2 && m.time >= 91) bomb2 = m.useBomb();
        m.update(1 / fps, 0, 0, true);
        sawBoss ||= !!m.boss?.active;
        sawEnemyBullet ||= m.enemyBullets.some((b) => b.active);
        sawDouble ||= m.weaponLevel > 1;
      }
      expect(sawBoss && sawEnemyBullet && sawDouble).toBe(true);
      expect(m.mode).toBe("won");
      expect(m.bossDefeated).toBe(true);
      expect(m.time).toBeGreaterThan(60);
      expect(m.time).toBeLessThan(115);
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
    m.invincible = 100; // Isolate pool cleanup from lethal aimed shots.
    run(m, 3);
    expect(m.enemies[0].y).toBeGreaterThanOrEqual(150);
    expect(m.enemies[0].y).toBeLessThan(153);
    expect(m.enemies[1].x).not.toBe(280);
    expect(m.enemyBullets.some((b) => b.active)).toBe(true);
    run(m, 13);
    expect(m.enemies.some((e) => e.active)).toBe(false);
    expect(m.enemyBullets.some((b) => b.active)).toBe(false);
    expect(m.enemyBullets.length).toBeLessThan(24);
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
  it("pickup heals at most to cap and power permanently upgrades through three levels", () => {
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
    expect(m.weaponLevel).toBe(2);
    m.update(0, 0, 0, true);
    expect(m.bullets.filter((b) => b.active)).toHaveLength(3);
    expect(m.bullets.map((b) => b.vx)).toEqual([
      expect.any(Number),
      0,
      expect.any(Number),
    ]);
    run(m, 16);
    expect(m.weaponLevel).toBe(2);
    for (let i = 0; i < 3; i++) {
      m.pickups.push({
        id: 30 + i,
        x: 180,
        y: 540,
        kind: "power",
        active: true,
      });
      m.update(0);
    }
    expect(m.weaponLevel).toBe(3);
    m.update(0, 0, 0, true);
    expect(m.bullets.filter((b) => b.active)).toHaveLength(5);
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

describe("weapon and encounter progression", () => {
  it("bomb is a bounded one-shot action, clears bullets, damages armor and gives protection", () => {
    const m = new FlightModel({
      ...empty,
      boss: { at: 0, hp: 100, fireEvery: 3, bulletSpeed: 100, points: 500 },
    });
    expect(m.useBomb()).toBe(false);
    m.start();
    m.update(0);
    m.enemies.push({
      id: 50,
      x: 80,
      y: 200,
      hp: 10,
      speed: 0,
      points: 100,
      active: true,
    });
    m.enemyBullets.push({
      id: 51,
      x: 180,
      y: 300,
      vx: 0,
      vy: 100,
      active: true,
    });
    expect(m.useBomb()).toBe(true);
    expect(m.bombs).toBe(1);
    expect(m.boss!.hp).toBe(82);
    expect(m.enemyBullets.every((b) => !b.active)).toBe(true);
    expect(m.enemies[0].active).toBe(false);
    expect(m.killCount).toBe(1);
    expect(m.score).toBe(100);
    expect(m.invincible).toBe(2);
    expect(m.bombFlash).toBeGreaterThan(0);
    expect(m.useBomb()).toBe(false);
    m.pause();
    const before = JSON.stringify(m);
    expect(m.useBomb()).toBe(false);
    run(m, 1);
    expect(JSON.stringify(m)).toBe(before);
    m.pause();
    run(m, 0.7);
    expect(m.useBomb()).toBe(true);
    run(m, 0.7);
    expect(m.useBomb()).toBe(false);
    expect(m.bombs).toBe(0);
    m.start();
    expect(m.bombs).toBe(2);
    expect(m.weaponLevel).toBe(1);
    expect(m.killCount + m.damageCount + m.pickupCount + m.bombFlash).toBe(0);
  });
  it("boss phase transitions announce and clear old bullets before new patterns", () => {
    const m = new FlightModel({
      ...empty,
      boss: { at: 0, hp: 180, fireEvery: 2.5, bulletSpeed: 100, points: 500 },
    });
    m.start();
    m.update(0);
    expect(m.boss!.phase).toBe(1);
    run(m, 3);
    expect(m.enemyBullets.some((b) => b.active)).toBe(true);
    m.boss!.hp = 110;
    m.update(0);
    expect(m.boss!.phase).toBe(2);
    expect(m.boss!.telegraph).toBe(1.2);
    expect(m.enemyBullets.every((b) => !b.active)).toBe(true);
    run(m, 1);
    expect(m.enemyBullets.every((b) => !b.active)).toBe(true);
    run(m, 0.7);
    expect(m.enemyBullets.filter((b) => b.active)).toHaveLength(5);
    m.boss!.hp = 50;
    m.update(0);
    expect(m.boss!.phase).toBe(3);
    expect(m.boss!.telegraph).toBe(1.2);
    run(m, 1.7);
    expect(m.enemyBullets.filter((b) => b.active)).toHaveLength(3);
  });
  it("formations are ordered, distinct, with a quiet supply window before boss", () => {
    expect(stage01.waves.map((w) => w.at)).toEqual(
      [...stage01.waves.map((w) => w.at)].sort((a, b) => a - b),
    );
    expect(
      new Set(stage01.waves.filter((w) => w.at < 12).map((w) => w.behavior)),
    ).toEqual(new Set(["straight"]));
    expect(
      stage01.waves
        .filter((w) => w.at >= 15 && w.at < 30)
        .every((w) => w.behavior === "weave" || w.behavior === "cross"),
    ).toBe(true);
    expect(
      stage01.waves.some((w) => w.behavior === "turret" && w.hp >= 5),
    ).toBe(true);
    expect(stage01.waves.every((w) => w.at < 60)).toBe(true);
    expect(stage01.pickups!.some((p) => p.at === 60 && p.kind === "heal")).toBe(
      true,
    );
  });
  it.each([30, 60, 120])(
    "beam switch with two timed bombs wins at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      let bomb1 = false,
        bomb2 = false;
      const phases = new Set<number>();
      let switched = false;
      for (let i = 0; i < 116 * fps; i++) {
        if (m.boss?.phase) phases.add(m.boss.phase);
        if (!switched && m.time >= 70) switched = m.switchWeapon();
        if (!bomb1 && m.time >= 85) {
          bomb1 = m.useBomb();
        }
        if (!bomb2 && m.time >= 91) {
          bomb2 = m.useBomb();
        }
        m.update(1 / fps, 0, 0, true);
      }
      expect(m.mode).toBe("won");
      expect(bomb1 && bomb2).toBe(true);
      expect(phases).toEqual(new Set([1, 2, 3]));
      expect(m.bombs).toBe(0);
    },
  );
  it("spread travels laterally, cleans up offscreen, and cannot revive a dead pilot", () => {
    const m = new FlightModel(empty);
    m.start();
    m.weaponLevel = 3;
    m.update(0, 0, 0, true);
    const xs = m.bullets.map((b) => b.x);
    run(m, 0.1);
    expect(m.bullets[0].x).toBeLessThan(xs[0]);
    expect(m.bullets[4].x).toBeGreaterThan(xs[4]);
    run(m, 2);
    expect(m.bullets.every((b) => !b.active)).toBe(true);
    m.hp = 1;
    m.enemyBullets.push({ id: 99, x: 180, y: 540, vx: 0, vy: 0, active: true });
    m.pickups.push({ id: 100, x: 180, y: 540, kind: "heal", active: true });
    m.update(0);
    expect(m.mode).toBe("lost");
    expect(m.hp).toBe(0);
    expect(m.useBomb()).toBe(false);
  });
});

describe("focused dual weapons", () => {
  it("focus lowers diagonal speed without changing input bounds, and pause freezes it", () => {
    const m = new FlightModel(empty);
    m.start();
    m.update(0.05, 1, -1, false, true);
    expect(Math.hypot(m.player.x - 180, m.player.y - 540)).toBeCloseTo(5);
    expect(m.focus).toBe(true);
    m.pause();
    m.update(0.05, 1, 0, false, false);
    expect(m.focus).toBe(true);
    m.pause();
    m.update(0.05, 1, 0, false, false);
    expect(m.focus).toBe(false);
    expect(m.player.x).toBeCloseTo(180 + 5 / Math.sqrt(2) + 12);
    m.start();
    expect(m.focus).toBe(false);
  });
  it.each([1, 2, 3])(
    "beam level %i emits one straight concentrated projectile with render metadata",
    (level) => {
      const m = new FlightModel(empty);
      expect(m.switchWeapon()).toBe(false);
      m.start();
      m.weaponLevel = level;
      expect(m.switchWeapon()).toBe(true);
      m.update(0, 0, 0, true);
      const b = m.bullets[0];
      expect(m.bullets).toHaveLength(1);
      expect(b).toMatchObject({
        kind: "beam",
        vx: 0,
        vy: -850,
        width: [5, 8, 12][level - 1],
        damage: [2, 3, 4][level - 1],
      });
      m.pause();
      expect(m.switchWeapon()).toBe(false);
      m.pause();
      m.switchWeapon();
      expect(m.weaponLevel).toBe(level);
      expect(m.weaponMode).toBe("missile");
      m.switchWeapon();
      expect(m.weaponMode).toBe("spread");
      m.start();
      expect(m.weaponMode).toBe("spread");
      expect(m.weaponLevel).toBe(1);
    },
  );
  it("aimed turret locks target during warning instead of tracking at release", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        {
          at: 0,
          x: 80,
          speed: 100,
          hp: 20,
          points: 1,
          behavior: "turret",
          fireEvery: 1,
        },
      ],
    });
    m.start();
    for (let i = 0; i < 120 && !m.enemies[0]?.telegraph; i++) m.update(1 / 60);
    const e = m.enemies[0];
    expect(e.telegraph).toBeGreaterThan(0);
    const angle = e.aimAngle!;
    for (let i = 0; i < 60; i++) m.update(1 / 60, 1, 0);
    const b = m.enemyBullets.find((b) => b.active)!;
    expect(b).toBeDefined();
    expect(Math.atan2(b.vx, b.vy)).toBeCloseTo(angle);
  });
  it("heavy fighter holds longer and projects a three-lane pattern", () => {
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
    m.invincible = 100;
    run(m, 3);
    expect(m.enemyBullets.filter((b) => b.active)).toHaveLength(3);
    expect(m.enemies[0].y).toBeLessThan(153);
    run(m, 4);
    expect(m.enemies[0].y).toBeLessThan(153);
    run(m, 2);
    expect(m.enemies[0].y).toBeGreaterThan(200);
  });
});

it.each([30, 60, 120])(
  "focused six-second dodge sweep can clear at %i FPS",
  (fps) => {
    const m = new FlightModel(stage01);
    m.start();
    let bomb1 = false,
      bomb2 = false;
    for (let i = 0; i < 116 * fps; i++) {
      if (!bomb1 && m.time >= 85) bomb1 = m.useBomb();
      if (!bomb2 && m.time >= 91) bomb2 = m.useBomb();
      const cycle = (m.time - 70) % 6;
      const dx = m.time < 70 ? 0 : cycle < 1.5 ? -1 : cycle < 4.5 ? 1 : -1;
      m.update(1 / fps, dx, 0, true, true);
    }
    expect(m.mode).toBe("won");
    expect(m.hp).toBeGreaterThan(0);
    expect(m.time).toBeLessThan(115);
  },
);

describe("homing and piercing", () => {
  it("C cycles three mechanically distinct modes and reset returns spread", () => {
    const m = new FlightModel(empty);
    m.start();
    m.switchWeapon();
    expect(m.weaponMode).toBe("beam");
    m.switchWeapon();
    expect(m.weaponMode).toBe("missile");
    m.switchWeapon();
    expect(m.weaponMode).toBe("spread");
  });
  it.each([1, 2, 3])(
    "missile level %i has finite life, limited turn rate and slower cadence",
    (level) => {
      const m = new FlightModel(empty);
      m.start();
      m.weaponLevel = level;
      m.switchWeapon();
      m.switchWeapon();
      m.enemies.push({
        id: 90,
        x: 280,
        y: 250,
        hp: 100,
        speed: 0,
        points: 1,
        active: true,
      });
      m.update(0, 0, 0, true);
      expect(m.bullets).toHaveLength(level === 1 ? 1 : 2);
      const b = m.bullets[0],
        initial = Math.atan2(b.vy!, b.vx!);
      m.update(0.05, 0, 0, true);
      expect(m.shots).toBe(1);
      expect(b.targetId).toBe(90);
      expect(Math.abs(Math.atan2(b.vy!, b.vx!) - initial)).toBeLessThanOrEqual(
        0.201,
      );
      expect(b.vx).toBeGreaterThan(Math.cos(initial) * 330);
      run(m, 4);
      expect(m.bullets.every((b) => !b.active)).toBe(true);
    },
  );
  it("missiles reacquire a live target when their target dies", () => {
    const m = new FlightModel(empty);
    m.start();
    m.switchWeapon();
    m.switchWeapon();
    m.enemies.push(
      { id: 90, x: 180, y: 300, hp: 20, speed: 0, points: 1, active: true },
      { id: 91, x: 240, y: 250, hp: 20, speed: 0, points: 1, active: true },
    );
    m.update(0.01, 0, 0, true);
    expect(m.bullets[0].targetId).toBe(90);
    m.enemies[0].active = false;
    m.update(0.01);
    expect(m.bullets[0].targetId).toBe(91);
  });
  it("one beam pierces distinct targets, never damages a target on successive overlap frames", () => {
    const m = new FlightModel(empty);
    m.start();
    m.switchWeapon();
    m.weaponLevel = 3;
    m.enemies.push(
      { id: 90, x: 180, y: 400, hp: 20, speed: 0, points: 1, active: true },
      { id: 91, x: 180, y: 350, hp: 20, speed: 0, points: 1, active: true },
    );
    m.update(0, 0, 0, true);
    const b = m.bullets[0];
    b.y = 400;
    b.vy = 0;
    m.update(0);
    m.update(0.01);
    m.update(0.01);
    expect(m.enemies[0].hp).toBe(16);
    expect(b.active).toBe(true);
    b.y = 350;
    m.update(0);
    m.update(0);
    expect(m.enemies[1].hp).toBe(16);
    expect(b.hitIds).toEqual([90, 91]);
    expect(b.pierceRemaining).toBe(2);
  });
  it("reused enemy pool slots receive new spawn identity for piercing", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        { at: 0, x: 100, speed: 0, hp: 1, points: 1 },
        { at: 1, x: 100, speed: 0, hp: 1, points: 1 },
      ],
    });
    m.start();
    m.update(0);
    const id = m.enemies[0].id;
    m.enemies[0].active = false;
    run(m, 1.1);
    expect(m.enemies).toHaveLength(1);
    expect(m.enemies[0].id).not.toBe(id);
  });
  it("dive warns then locks its path; cross enters from the side and exits", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        { at: 0, x: 75, speed: 140, hp: 3, points: 1, behavior: "dive" },
        {
          at: 0,
          x: -30,
          spawnY: 160,
          direction: 1,
          speed: 125,
          hp: 2,
          points: 1,
          behavior: "cross",
        },
      ],
    });
    m.start();
    run(m, 1.2);
    expect(m.enemies[0].telegraph).toBeGreaterThan(0);
    expect(m.enemies[1].y).toBe(160);
    expect(m.enemies[1].x).toBeCloseTo(120, 0);
    run(m, 0.6);
    const angle = m.enemies[0].diveAngle;
    expect(angle).toBeDefined();
    for (let i = 0; i < 30; i++) m.update(1 / 60, 1, 0);
    expect(m.enemies[0].diveAngle).toBe(angle);
    run(m, 2);
    expect(m.enemies[1].active).toBe(false);
  });
});
it.each([30, 60, 120])("missile boss route is playable at %i FPS", (fps) => {
  const m = new FlightModel(stage01);
  m.start();
  let switched = false,
    b1 = false,
    b2 = false;
  for (let i = 0; i < 116 * fps; i++) {
    if (!switched && m.time >= 70) {
      m.switchWeapon();
      m.switchWeapon();
      switched = true;
    }
    if (!b1 && m.time >= 85) b1 = m.useBomb();
    if (!b2 && m.time >= 91) b2 = m.useBomb();
    m.update(1 / fps, 0, 0, true);
  }
  console.log("missile route", fps, m.mode, m.time, m.hp, m.boss?.hp);
  expect(m.mode).toBe("won");
});
