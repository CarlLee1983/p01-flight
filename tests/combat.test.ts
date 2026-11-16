import { describe, it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01, GROUND_VISIBLE_Y, type StageConfig } from "../src/data/stage";
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
      const cannonTimes: number[] = [];
      let sawBoss = false,
        sawEnemyBullet = false,
        sawDouble = false;
      let bomb1 = false,
        bomb2 = false;
      for (let i = 0; i < 171 * fps; i++) {
        if (!bomb1 && m.time >= 140) bomb1 = m.useBomb();
        if (!bomb2 && m.time >= 146) bomb2 = m.useBomb();
        m.update(1 / fps, 0, 0, true);
        if (m.partsDestroyed > cannonTimes.length) cannonTimes.push(m.time);
        sawBoss ||= !!m.boss?.active;
        sawEnemyBullet ||= m.enemyBullets.some((b) => b.active);
        sawDouble ||= m.weaponLevel > 1;
      }
      expect(sawBoss && sawEnemyBullet && sawDouble).toBe(true);
      expect(m.mode).toBe("won");
      expect(m.bossDefeated).toBe(true);
      expect(m.partsDestroyed).toBe(2);
      expect(m.time).toBeGreaterThan(60);
      expect(m.time).toBeLessThan(stage01.duration);
      expect(m.score).toBeGreaterThanOrEqual(2500);
      expect(m.hp).toBeGreaterThan(0);
      console.log(
        `Stage01 ${fps}fps: won at ${m.time.toFixed(2)}s, hp=${m.hp}, score=${m.score}, cannons=${cannonTimes.map((t) => t.toFixed(2)).join(",")}`,
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
      stage01.waves.some((w) => w.behavior === "gatekeeper" && w.hp >= 5),
    ).toBe(true);
    expect(stage01.waves.every((w) => w.at < 121)).toBe(true);
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
      for (let i = 0; i < 171 * fps; i++) {
        if (m.boss?.phase) phases.add(m.boss.phase);
        if (!switched && m.time >= 125) switched = m.switchWeapon();
        if (!bomb1 && m.time >= 140) {
          bomb1 = m.useBomb();
        }
        if (!bomb2 && m.time >= 146) {
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
    for (let i = 0; i < 171 * fps; i++) {
      if (!bomb1 && m.time >= 140) bomb1 = m.useBomb();
      if (!bomb2 && m.time >= 146) bomb2 = m.useBomb();
      const cycle = (m.time - 125) % 6;
      const dx = m.time < 125 ? 0 : cycle < 1.5 ? -1 : cycle < 4.5 ? 1 : -1;
      m.update(1 / fps, dx, 0, true, true);
    }
    expect(m.mode).toBe("won");
    expect(m.hp).toBeGreaterThan(0);
    expect(m.time).toBeLessThan(stage01.duration);
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
  for (let i = 0; i < 171 * fps; i++) {
    if (!switched && m.time >= 125) {
      m.switchWeapon();
      m.switchWeapon();
      switched = true;
    }
    if (!b1 && m.time >= 140) b1 = m.useBomb();
    if (!b2 && m.time >= 146) b2 = m.useBomb();
    m.update(1 / fps, m.time >= 150 && m.time < 150.3 ? 1 : 0, 0, true, true);
  }
  console.log("missile route", fps, m.mode, m.time, m.hp, m.boss?.hp);
  expect(m.mode).toBe("won");
});

describe("weapon supply and temporary escorts", () => {
  it.each([30, 60, 120])(
    "S/B/M packages select and upgrade shared level at %i FPS",
    (fps) => {
      const m = new FlightModel(empty);
      m.start();
      for (const [index, kind] of (
        ["spread", "beam", "missile"] as const
      ).entries()) {
        m.pickups.push({
          id: 900 + index,
          x: m.player.x,
          y: m.player.y,
          active: true,
          kind,
        });
        m.update(1 / fps);
        expect(m.weaponMode).toBe(kind);
        expect(m.weaponLevel).toBe(Math.min(3, index + 2));
        const count = m.pickupCount;
        m.update(1 / fps);
        expect(m.pickupCount).toBe(count);
      }
      m.switchWeapon();
      expect(m.weaponMode).toBe("spread");
      expect(m.weaponLevel).toBe(3);
      m.start();
      expect(m.weaponLevel).toBe(1);
    },
  );
  it.each([30, 60, 120])(
    "eight-second escorts shoot independently, expire and never block at %i FPS",
    (fps) => {
      const m = new FlightModel(empty);
      m.start();
      m.switchWeapon();
      m.pickups.push({
        id: 900,
        x: 180,
        y: 540,
        active: true,
        kind: "support",
      });
      m.update(1 / fps);
      expect(m.supportTime).toBe(8);
      expect(m.weaponMode).toBe("beam");
      expect(m.weaponLevel).toBe(1);
      expect(m.supportDrones).toEqual([
        { x: 148, y: 552 },
        { x: 212, y: 552 },
      ]);
      m.enemyBullets.push({
        id: 901,
        x: 148,
        y: 552,
        vx: 0,
        vy: 0,
        active: true,
      });
      m.update(1 / fps, 0, 0, true);
      expect(
        m.bullets.filter((b) => b.kind === "support" && b.active),
      ).toHaveLength(2);
      expect(m.supportShots).toBe(1);
      expect(m.enemyBullets[0].active).toBe(true);
      expect(m.hp).toBe(3);
      run(m, 2, true, fps);
      expect(m.supportShots).toBeGreaterThan(5);
      m.pause();
      const frozen = m.supportTime;
      run(m, 1, true, fps);
      expect(m.supportTime).toBe(frozen);
      m.pause();
      run(m, 7, false, fps);
      expect(m.supportTime).toBe(0);
      expect(m.supportDrones).toHaveLength(0);
      const shots = m.supportShots;
      run(m, 1, true, fps);
      expect(m.supportShots).toBe(shots);
      m.start();
      expect(m.supportTime).toBe(0);
      expect(m.supportShots).toBe(0);
    },
  );
  it("support refresh is capped at eight seconds and dead pilots cannot collect it", () => {
    const m = new FlightModel(empty);
    m.start();
    m.supportTime = 6;
    m.pickups.push({ id: 1, x: 180, y: 540, kind: "support", active: true });
    m.update(0);
    expect(m.supportTime).toBe(8);
    m.hp = 1;
    m.invincible = 0;
    m.enemyBullets.push({ id: 2, x: 180, y: 540, vx: 0, vy: 0, active: true });
    m.pickups.push({ id: 3, x: 180, y: 540, kind: "missile", active: true });
    m.update(0);
    expect(m.mode).toBe("lost");
    expect(m.weaponMode).toBe("spread");
  });
  it.each([30, 60, 120])(
    "carrier crosses without firing and drops its exact package once at %i FPS",
    (fps) => {
      const m = new FlightModel({
        ...empty,
        waves: [
          {
            at: 0,
            x: -30,
            spawnY: 110,
            direction: 1,
            speed: 65,
            hp: 4,
            points: 200,
            behavior: "carrier",
            drop: "missile",
          },
        ],
      });
      m.start();
      run(m, 2, false, fps);
      const e = m.enemies[0];
      expect(e.x).toBeCloseTo(100, 0);
      expect(e.y).toBe(110);
      expect(m.enemyBullets).toHaveLength(0);
      m.bullets.push({ id: 900, x: e.x, y: e.y, active: true, damage: 4 });
      m.update(0);
      m.update(0);
      expect(
        m.pickups.filter((p) => p.active && p.kind === "missile"),
      ).toHaveLength(1);
      expect(m.score).toBe(200);
    },
  );
});

describe("encounter sections and breakable cannons", () => {
  it("sections change at declared boundaries and restart returns approach", () => {
    const m = new FlightModel(stage01);
    m.start();
    expect(m.section.id).toBe("approach");
    for (const [at, id] of [
      [15, "crossing"],
      [32, "harbor"],
      [56, "resupply"],
      [125, "commander"],
    ] as const) {
      m.time = at - 0.01;
      expect(m.section.id).not.toBe(id);
      m.time = at;
      expect(m.section.id).toBe(id);
    }
    expect(stage01.waves.some((w) => w.at >= 121 && w.at < 125)).toBe(false);
    expect(stage01.pickups!.some((p) => p.kind === "heal" && p.at === 60)).toBe(
      true,
    );
    expect(
      stage01.pickups!.some((p) => p.kind === "support" && p.at === 39),
    ).toBe(true);
    m.start();
    expect(m.section.id).toBe("approach");
  });
  it.each([30, 60, 120])(
    "breaking a cannon removes its future outer shot but not the core objective at %i FPS",
    (fps) => {
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
      m.invincible = 100;
      run(m, 2, false, fps);
      const boss = m.boss!,
        left = boss.cannons[0],
        right = boss.cannons[1];
      expect(left.x).toBeCloseTo(boss.x - 68);
      expect(right.x).toBeCloseTo(boss.x + 68);
      m.bullets.push({
        id: 900,
        x: left.x,
        y: left.y,
        active: true,
        damage: 24,
      });
      m.update(0);
      expect(left.active).toBe(false);
      expect(left.hp).toBe(0);
      expect(right.active).toBe(true);
      expect(m.partsDestroyed).toBe(1);
      expect(m.score).toBe(250);
      expect(boss.hp).toBe(388);
      expect(m.mode).toBe("playing");
      const before = m.enemyBullets.filter((b) => b.active).length;
      boss.telegraph = 0;
      boss.fireCooldown = 0;
      m.update(0);
      expect(m.enemyBullets.filter((b) => b.active).length - before).toBe(1);
      m.bullets.push({
        id: 901,
        x: left.x,
        y: left.y,
        active: true,
        damage: 24,
      });
      m.update(0);
      expect(m.score).toBe(250);
      expect(m.partsDestroyed).toBe(1);
      m.bullets.push({
        id: 902,
        x: boss.x,
        y: boss.y,
        active: true,
        damage: 400,
      });
      m.update(0);
      expect(m.mode).toBe("won");
      expect(right.active).toBe(true);
      expect(m.score).toBe(3250);
      m.start();
      expect(m.partsDestroyed).toBe(0);
      expect(m.boss).toBeNull();
    },
  );
  it("beam overlap damages each part once; bomb deals bounded damage without duplicate score", () => {
    const m = new FlightModel({
      ...empty,
      boss: {
        at: 0,
        hp: 400,
        sideCannonHp: 24,
        fireEvery: 9,
        bulletSpeed: 100,
        points: 3000,
      },
    });
    m.start();
    run(m, 2);
    const boss = m.boss!,
      part = boss.cannons[0];
    m.bullets.push({
      id: 900,
      x: part.x,
      y: part.y,
      active: true,
      vx: 0,
      vy: 0,
      kind: "beam",
      damage: 4,
      pierceRemaining: 4,
      hitIds: [],
    });
    m.update(0);
    m.update(0);
    expect(part.hp).toBe(20);
    expect(boss.hp).toBe(400);
    expect(m.bullets[0].hitIds).toEqual([part.id]);
    expect(m.useBomb()).toBe(true);
    expect(part.hp).toBe(14);
    expect(m.useBomb()).toBe(false);
    expect(part.hp).toBe(14);
    m.pause();
    const state = JSON.stringify(boss);
    run(m, 2);
    expect(JSON.stringify(boss)).toBe(state);
  });
});

describe("ground targets", () => {
  it.each([30, 60, 120])(
    "ground objects move with terrain, never ram, but batteries shoot at %i FPS",
    (fps) => {
      const m = new FlightModel({
        ...empty,
        waves: [
          {
            at: 0,
            x: 180,
            spawnY: 540,
            speed: 999,
            hp: 5,
            points: 100,
            behavior: "groundDepot",
            fireEvery: 0.1,
            drop: "heal",
          },
          {
            at: 0,
            x: 80,
            spawnY: 70,
            speed: 999,
            hp: 5,
            points: 100,
            behavior: "groundBattery",
            fireEvery: 1,
            firstFireDelay: 0.6,
          },
        ],
      });
      m.start();
      run(m, 2, false, fps);
      expect(m.hp).toBe(3);
      expect(m.enemies[0].y).toBeCloseTo(604, 6);
      expect(m.enemies[1].y).toBeCloseTo(134, 6);
      expect(m.enemies[0].x).toBe(180);
      expect(m.enemyBullets.some((b) => b.active)).toBe(true);
      m.bullets.push({ id: 990, x: 180, y: 604, active: true, damage: 5 });
      m.update(0);
      m.update(0);
      expect(m.score).toBe(100);
      expect(
        m.pickups.filter((p) => p.kind === "heal" && p.active),
      ).toHaveLength(1);
    },
  );
  it.each([30, 60, 120])(
    "ground batteries remain inspectable at 35–36 seconds at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      run(m, 35, true, fps);
      const before = m.enemies
        .filter((e) => e.active && e.behavior === "groundBattery")
        .map((e) => ({ id: e.id, y: e.y }));
      expect(before).toHaveLength(2);
      run(m, 1, true, fps);
      const batteries = m.enemies.filter(
        (e) => e.active && e.behavior === "groundBattery",
      );
      console.log(
        "ground at36",
        batteries.map((e) => ({ x: e.x, y: e.y, hp: e.hp })),
      );
      expect(batteries).toHaveLength(2);
      for (const e of batteries)
        expect(e.y - before.find((b) => b.id === e.id)!.y).toBeCloseTo(32, 5);
    },
  );
});

describe("Stage01 pacing pass", () => {
  it("opening has a leader, left echelon and mirrored right echelon without extra aircraft", () => {
    const opening = stage01.waves.filter((w) => w.at < 11);
    expect(opening).toHaveLength(9);
    expect(opening.filter((w) => w.at < 3).map((w) => [w.at, w.x])).toEqual([
      [2, 180],
      [2.22, 120],
      [2.22, 240],
    ]);
    expect(
      opening.filter((w) => w.at >= 6 && w.at < 7).map((w) => [w.at, w.x]),
    ).toEqual([
      [6, 90],
      [6.22, 150],
      [6.44, 210],
    ]);
    expect(opening.filter((w) => w.at >= 10).map((w) => [w.at, w.x])).toEqual([
      [10, 270],
      [10.22, 210],
      [10.44, 150],
    ]);
    expect(
      stage01.waves.filter((w) => w.behavior === "carrier").map((w) => w.at),
    ).toEqual([12, 30, 48, 73, 93, 114]);
    expect(
      stage01.waves.some((w) => w.behavior === "heavy" && w.at === 54),
    ).toBe(false);
    expect(
      stage01.waves.filter((w) => w.behavior === "gatekeeper").map((w) => w.at),
    ).toEqual([40]);
    expect(
      stage01.waves.filter((w) => w.behavior === "dive").map((w) => w.at),
    ).toEqual([34, 35.2, 50, 51.2, 90, 91.1, 102, 103.1]);
  });
  it.each([30, 60, 120])(
    "schedule clears residual enemies before the 121–125 second rest at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      // Isolate exit timing even when enemies survive. Not a gameplay victory fixture.
      m.invincible = 200;
      run(m, 121, false, fps);
      for (let i = 0; i < 3.8 * fps; i++) {
        expect(m.enemies.some((e) => e.active)).toBe(false);
        expect(m.enemyBullets.some((b) => b.active)).toBe(false);
        expect(m.boss).toBeNull();
        m.update(1 / fps);
      }
    },
  );
  it.each([30, 60, 120])(
    "idle normal-input pilot still loses at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      run(m, 60, false, fps);
      expect(m.mode).toBe("lost");
      expect(m.lostReason).toBe("damage");
    },
  );
});

describe("gatekeeper encounter", () => {
  it.each([30, 60, 120])(
    "normal centered firing still exposes elite warnings and at least one volley at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      let warning = false,
        volley = false,
        first = -1,
        last = -1;
      for (let i = 0; i < 52 * fps; i++) {
        m.update(1 / fps, 0, 0, true);
        const e = m.enemies.find(
          (e) => e.active && e.behavior === "gatekeeper",
        );
        if (e) {
          if (first < 0) first = m.time;
          last = m.time;
          warning ||= (e.telegraph ?? 0) > 0;
          volley ||= (e.gateCycle ?? 0) > 0;
          expect(e.maxHp).toBe(64);
        }
      }
      expect(warning).toBe(true);
      expect(volley).toBe(true);
      expect(last - first).toBeGreaterThan(3);
      console.log("gate visibility", fps, first, last);
    },
  );
  it.each([30, 60, 120])(
    "left, right and locked aim are telegraphed and bounded at %i FPS",
    (fps) => {
      const m = new FlightModel({
        ...empty,
        waves: [
          {
            at: 0,
            x: 180,
            speed: 130,
            hp: 1000,
            points: 1,
            behavior: "gatekeeper",
            fireEvery: 2.2,
            holdFor: 9,
            strafeWidth: 75,
          },
        ],
      });
      m.start();
      m.invincible = 100;
      const patterns = new Set<string>();
      const volleys: number[] = [];
      let cycle = 0;
      for (let i = 0; i < 10 * fps; i++) {
        m.update(1 / fps);
        const e = m.enemies[0];
        if ((e.telegraph ?? 0) > 0) {
          patterns.add(e.attackPattern!);
          if (e.attackPattern === "left")
            expect(e.attackLanes).toEqual([54, 100.80000000000001, 147.6]);
          if (e.attackPattern === "right")
            expect(e.attackLanes).toHaveLength(3);
        }
        if ((e.gateCycle ?? 0) > cycle) {
          cycle = e.gateCycle!;
          volleys.push(cycle);
        }
      }
      expect(patterns).toEqual(new Set(["left", "right", "aim"]));
      expect(volleys).toEqual([1, 2, 3]);
      expect(m.enemies[0].telegraph).toBe(0);
      expect(m.enemies[0].attackLanes).toEqual([]);
      expect(m.enemies[0].y).toBeGreaterThan(150);
      run(m, 6);
      expect(m.enemies.some((e) => e.active)).toBe(false);
    },
  );
  it("elite reward is single-drop and pause/restart reset encounter state", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        {
          at: 0,
          x: 180,
          spawnY: 150,
          speed: 130,
          hp: 1,
          points: 1000,
          behavior: "gatekeeper",
          drop: "power",
          fireEvery: 2.2,
          holdFor: 9,
        },
      ],
    });
    m.start();
    m.update(0);
    m.pause();
    const frozen = JSON.stringify(m.enemies);
    run(m, 1);
    expect(JSON.stringify(m.enemies)).toBe(frozen);
    m.pause();
    const e = m.enemies[0];
    m.bullets.push({ id: 999, x: e.x, y: e.y, active: true });
    m.update(0);
    m.update(0);
    expect(m.score).toBe(1000);
    expect(
      m.pickups.filter((p) => p.active && p.kind === "power"),
    ).toHaveLength(1);
    m.start();
    expect(m.enemies).toHaveLength(0);
  });
});

it("gatekeeper aim locks during warning while strafing remains a trackable target", () => {
  const m = new FlightModel({
    ...empty,
    waves: [
      {
        at: 0,
        x: 180,
        speed: 130,
        hp: 1000,
        points: 1,
        behavior: "gatekeeper",
        fireEvery: 2.2,
        holdFor: 9,
        strafeWidth: 75,
      },
    ],
  });
  m.start();
  m.invincible = 100;
  let warned = false,
    locked = 0;
  const xs: number[] = [];
  for (let i = 0; i < 10 * 60; i++) {
    const e = m.enemies[0];
    if (e?.attackPattern === "aim" && (e.telegraph ?? 0) > 0 && !warned) {
      warned = true;
      locked = e.aimAngle!;
    }
    m.update(1 / 60, warned ? 1 : 0);
    if (m.enemies[0]) xs.push(m.enemies[0].x);
    if ((m.enemies[0]?.gateCycle ?? 0) >= 3) break;
  }
  expect(warned).toBe(true);
  expect(m.player.x).toBeGreaterThan(180);
  expect(
    m.enemyBullets.some(
      (b) =>
        b.active &&
        Math.abs(b.vx - Math.sin(locked) * 180) < 0.001 &&
        Math.abs(b.vy - Math.cos(locked) * 180) < 0.001,
    ),
  ).toBe(true);
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
});

describe("escort formation density", () => {
  it("keeps the expanded first-stage density bounded and preserves the boss rest", () => {
    expect(stage01.waves).toHaveLength(99);
    expect(stage01.waves.filter((w) => w.behavior === "escort")).toHaveLength(
      12,
    );
    expect(stage01.waves.filter((w) => w.behavior === "cross")).toHaveLength(
      29,
    );
    expect(stage01.duration).toBe(170);
    expect(stage01.boss!.at).toBe(125);
    expect(stage01.waves.every((w) => w.at < 121)).toBe(true);
  });
  it.each([30, 60, 120])(
    "escort wings share formation phase, warn then fire only one fan at %i FPS",
    (fps) => {
      const m = new FlightModel({
        ...empty,
        waves: [100, 180, 260].map((x, i) => ({
          at: i * 0.8,
          x,
          speed: 140,
          hp: 100,
          points: 160,
          behavior: "escort" as const,
          formationPhase: i * 0.8,
        })),
      });
      m.start();
      m.invincible = 100;
      let warnings = 0;
      const seen = new Set<number>();
      for (let i = 0; i < 2.6 * fps; i++) {
        m.update(1 / fps);
        for (const e of m.enemies)
          if ((e.telegraph ?? 0) > 0 && !seen.has(e.id)) {
            seen.add(e.id);
            warnings++;
          }
      }
      expect(warnings).toBe(3);
      const offsets = m.enemies.map((e) => e.x - e.originX!);
      expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThan(1.1);
      run(m, 1, false, fps);
      expect(m.enemies.every((e) => e.volleyFired)).toBe(true);
      expect(m.enemyBullets.length).toBeLessThanOrEqual(9);
      // Expired bullets must not be replaced by a second volley.
      run(m, 7, false, fps);
      expect(m.enemies.some((e) => e.active)).toBe(false);
      expect(m.enemyBullets.some((b) => b.active)).toBe(false);
    },
  );
  it("escort aim locks at warning and a re-used pool slot resets one-shot flag", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        { at: 0, x: 80, speed: 140, hp: 100, points: 1, behavior: "escort" },
        { at: 8, x: 80, speed: 140, hp: 100, points: 1, behavior: "escort" },
      ],
    });
    m.start();
    m.invincible = 100;
    run(m, 1);
    const aim = m.enemies[0].aimAngle!;
    for (let i = 0; i < 45; i++) m.update(1 / 60, 1, 0);
    expect(m.enemies[0].volleyFired).toBe(true);
    expect(
      m.enemyBullets.some(
        (b) => Math.abs(Math.atan2(b.vx, b.vy) - aim) < 0.001,
      ),
    ).toBe(true);
    run(m, 6.4);
    expect(m.enemies).toHaveLength(1);
    expect(m.enemies[0].active).toBe(true);
    expect(m.enemies[0].volleyFired).toBe(false);
  });
  it.each([30, 60, 120])(
    "center-fire route exposes escort warning and volley at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      let warning = false,
        volley = false;
      for (let i = 0; i < 58 * fps; i++) {
        m.update(1 / fps, 0, 0, true);
        for (const e of m.enemies)
          if (e.behavior === "escort") {
            warning ||= !!e.active && (e.telegraph ?? 0) > 0;
            volley ||= !!e.volleyFired;
          }
      }
      expect(warning).toBe(true);
      expect(volley).toBe(true);
    },
  );
});

describe("ground readability under real continuous fire", () => {
  it.each([30, 60, 120])(
    "center-fire sees battery warning, firing and then destruction at %i FPS",
    (fps) => {
      const m = new FlightModel(stage01);
      m.start();
      let visible = 0,
        warning = false,
        shot = false,
        deadAt = 0,
        watchId = 0;
      for (let i = 0; i < 42 * fps; i++) {
        m.update(1 / fps, 0, 0, true);
        const e = m.enemies.find(
          (e) =>
            e.behavior === "groundBattery" && (!watchId || e.id === watchId),
        );
        if (e) {
          if (!watchId) watchId = e.id;
          if (e.visibleSince !== undefined && !visible)
            visible = e.visibleSince;
          warning ||= e.active && (e.telegraph ?? 0) > 0;
          shot ||= (e.shotsFired ?? 0) > 0;
          if (!e.active && !deadAt) deadAt = m.time;
        }
      }
      expect(visible).toBeGreaterThan(32);
      expect(warning).toBe(true);
      expect(shot).toBe(true);
      expect(m.groundShotCount).toBeGreaterThanOrEqual(2);
      expect(deadAt - visible).toBeGreaterThan(1.5);
      console.log(
        "battery visible/shot/dead",
        fps,
        visible,
        m.groundShotCount,
        deadAt,
      );
    },
  );
  it("hidden ground cannot be missile-locked, bombed, shot or shoot", () => {
    const m = new FlightModel({
      ...empty,
      waves: [
        {
          at: 0,
          x: 180,
          spawnY: GROUND_VISIBLE_Y - 18,
          speed: 32,
          hp: 18,
          points: 1,
          behavior: "groundBattery",
          fireEvery: 0.1,
          firstFireDelay: 0.1,
        },
      ],
    });
    m.start();
    m.switchWeapon();
    m.switchWeapon();
    m.update(0, 0, 0, true);
    expect(m.bullets[0].targetId).toBeUndefined();
    m.bullets.push({
      id: 999,
      x: 180,
      y: GROUND_VISIBLE_Y - 18,
      active: true,
      damage: 100,
    });
    m.update(0);
    expect(m.enemies[0].hp).toBe(18);
    m.useBomb();
    expect(m.enemies[0].hp).toBe(18);
    expect(m.enemies[0].visibleSince).toBeUndefined();
    run(m, 0.3);
    expect(m.groundShotCount).toBe(0);
    m.start();
    expect(m.groundShotCount).toBe(0);
  });
  it("14-second continuous-fire screenshot route still has a living escort", () => {
    const m = new FlightModel(stage01);
    m.start();
    run(m, 14, true);
    expect(m.enemies.some((e) => e.active && e.behavior === "escort")).toBe(
      true,
    );
  });
});
