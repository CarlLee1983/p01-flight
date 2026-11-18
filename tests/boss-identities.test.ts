import { bossAimGoal } from "./boss-counterplay";
import { describe, it, expect } from "vitest";
import {
  bossRig,
  bossPose,
  bossMount,
  bossPartBudget,
  bossPartContains,
  bossCoreContains,
  bossCoreState,
  type BossSkin,
  RIVER_BOW_ART,
} from "../src/game/boss-rigs";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { resolveBossRay, bossShotOrigin } from "../src/game/boss-muzzles";
import { bossAttackPlan } from "../src/game/boss-attacks";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assets from "../docs/boss-identities-assets.json";
const skins: BossSkin[] = ["command", "riverFortress", "polarRadar"];
it("three rigs have different structures, textures and conserved armour rewards", () => {
  expect(skins.map((s) => bossRig(s).partCount)).toEqual([2, 3, 4]);
  expect(new Set(skins.map((s) => bossRig(s).key)).size).toBe(3);
  for (const skin of skins)
    for (const hp of [24, 28]) {
      const budget = bossPartBudget(skin, hp);
      expect(budget.reduce((a, p) => a + p.hp, 0)).toBe(hp * 2);
      expect(budget.reduce((a, p) => a + p.breakDamage, 0)).toBe(24);
      expect(budget.reduce((a, p) => a + p.points, 0)).toBe(500);
    }
  for (const a of assets) {
    const b = readFileSync("public/assets/original/" + a.key + ".webp");
    expect(createHash("sha256").update(b).digest("hex")).toBe(a.sha256);
    expect(b.length).toBeLessThan(250000);
  }
});
describe.each(skins)("%s rig", (skin) => {
  it.each([30, 60, 120])(
    "continuous finite poses and complete mounts at %i FPS",
    (fps) => {
      for (const phase of [1, 2, 3] as const) {
        let previous = bossPose(skin, 0, phase),
          moving = 0,
          resting = 0,
          maxStep = 0,
          minX = Infinity,
          maxX = -Infinity,
          minMount = Infinity,
          maxMount = -Infinity,
          finite = true;
        for (let frame = 1; frame < 20 * fps; frame++) {
          const p = bossPose(skin, frame / fps, phase);
          finite &&= Object.values(p).every(
            (v) => typeof v !== "number" || Number.isFinite(v),
          );
          maxStep = Math.max(
            maxStep,
            Math.hypot(p.x - previous.x, p.y - previous.y),
          );
          if (p.entered) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            if (p.canFire) resting++;
            else moving++;
          }
          for (let i = 0; i < bossRig(skin).partCount; i++) {
            const m = bossMount(skin, i, p);
            minMount = Math.min(minMount, m.x);
            maxMount = Math.max(maxMount, m.x);
            finite &&= bossPartContains({ skin }, { ...m }, m.x, m.y);
          }
          previous = p;
        }
        expect(finite).toBe(true);
        expect(maxStep).toBeLessThan(280 / fps);
        expect(minX).toBeGreaterThan(100);
        expect(maxX).toBeLessThan(260);
        expect(minMount).toBeGreaterThan(15);
        expect(maxMount).toBeLessThan(345);
        expect(resting).toBeGreaterThan(0);
        if (skin !== "command" || phase === 3)
          expect(moving).toBeGreaterThan(0);
      }
    },
  );
  it("all phases warn locally, fire from live mounts, and cancel destroyed sources", () => {
    const m = new FlightModel({
      ...stage01,
      duration: 120,
      waves: [],
      pickups: [],
      boss: { ...stage01.boss!, skin, at: 0 },
    });
    m.start();
    m.invincible = 120; // Isolated outgoing geometry, not a victory proof.
    for (const phase of [1, 2, 3] as const) {
      m.boss ?? m.update(1 / 60);
      const boss = m.boss!;
      boss.hp = boss.maxHp * (phase === 1 ? 1 : phase === 2 ? 0.5 : 0.2);
      let planned = false,
        emitted = false;
      for (let frame = 0; frame < 15 * 60; frame++) {
        const count = m.emittedBossShots;
        m.update(1 / 60);
        if (boss.attackWarning > 0) {
          planned = true;
          expect(boss.attackPlan!.length).toBeGreaterThan(0);
        }
        if (m.emittedBossShots > count) {
          expect(planned).toBe(true);
          emitted = true;
          break;
        }
      }
      expect(emitted).toBe(true);
      for (const ray of bossAttackPlan(boss, m.player)) {
        const p = resolveBossRay(boss, ray);
        expect(Number.isFinite(p.x + p.y + p.angle)).toBe(true);
        if (ray.mount !== null) {
          const part = boss.cannons[ray.mount];
          part.active = false;
          expect(resolveBossRay(boss, ray).active).toBe(false);
          part.active = true;
        }
      }
    }
  });
});
it("river bridge can be hit without treating the whole hull as a core shield", () => {
  const b = { skin: "riverFortress" as const, x: 180, y: 185, roll: 0 };
  expect(bossCoreContains(b, 180, 117)).toBe(true);
  expect(bossCoreContains(b, 180, 220)).toBe(false);
});

it("destroyed river deck guns retain distinct phase counterplay from a visible bow launcher", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, skin: "riverFortress", at: 0 },
  });
  m.start();
  m.update(1 / 60);
  const b = m.boss!;
  b.cannons.forEach((p) => (p.active = false));
  const signatures = [];
  for (const phase of [1, 2, 3] as const) {
    b.phase = phase;
    b.attackCycle = 0;
    const rays = bossAttackPlan(b, { x: 180, y: 540 });
    expect(rays).toHaveLength(phase === 3 ? 5 : 2);
    expect(
      rays.every((ray) => ray.mount === null && ray.style === "rocket"),
    ).toBe(true);
    signatures.push(JSON.stringify(rays.map((ray) => [ray.angle, ray.delay])));
    if (phase === 2) {
      const mean = rays.reduce((n, r) => n + r.angle, 0) / rays.length;
      b.attackCycle = 1;
      const next = bossAttackPlan(b, { x: 180, y: 540 });
      expect(
        mean - next.reduce((n, r) => n + r.angle, 0) / next.length,
      ).toBeCloseTo(0.44);
    }
  }
  expect(new Set(signatures).size).toBe(3);
});

it("bow launcher display scale and rotated physical barrel agree with imported pixel calibration", () => {
  const source = assets.find((a) => a.key === "boss-river-turret-v2")!;
  expect(RIVER_BOW_ART.muzzleY).toBeCloseTo(
    ((1170 - source.pivot[1]) * source.scale) / 8,
  );
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, skin: "riverFortress", at: 0 },
  });
  m.start();
  m.update(1 / 60);
  const b = m.boss!;
  for (const roll of [-0.2, 0, 0.2])
    for (const aim of [-0.7, 0, 0.7])
      for (const lateral of [-1.5, 1.5]) {
        b.roll = roll;
        b.coreAimAngle = aim;
        const p = bossShotOrigin(b, { mount: null, lateral });
        expect(p.x).toBeCloseTo(
          b.x -
            Math.sin(roll) * 71 +
            Math.sin(aim) * 11 +
            Math.cos(aim) * lateral,
        );
        expect(p.y).toBeCloseTo(
          b.y +
            Math.cos(roll) * 71 +
            Math.cos(aim) * 11 -
            Math.sin(aim) * lateral,
        );
      }
});

it("aimed cones keep distinct rays at screen corners and when the player flies behind the Boss", () => {
  for (const skin of skins) {
    const m = new FlightModel({
      ...stage01,
      waves: [],
      pickups: [],
      boss: { ...stage01.boss!, skin, at: 0 },
    });
    m.start();
    m.update(1 / 60);
    const b = m.boss!;
    b.phase = 3;
    b.x = 180;
    b.y = 190;
    b.cannons.forEach((p) => (p.active = false));
    for (const player of [
      { x: 18, y: 18 },
      { x: 342, y: 18 },
      { x: 18, y: 620 },
      { x: 342, y: 620 },
    ]) {
      const rays = bossAttackPlan(b, player),
        angles = rays.map((r) => r.angle).sort((a, b) => a - b);
      expect(new Set(angles.map((a) => a.toFixed(8))).size).toBe(rays.length);
      expect(angles[0]).toBeGreaterThanOrEqual(-1.100000001);
      expect(angles.at(-1)!).toBeLessThanOrEqual(1.100000001);
      for (let i = 1; i < angles.length; i++)
        expect(angles[i] - angles[i - 1]).toBeGreaterThan(0.22);
    }
  }
});
it("polar core and collinear rim pulses are half a burst beat apart instead of stacking", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, skin: "polarRadar", at: 0 },
  });
  m.start();
  m.update(1 / 60);
  const b = m.boss!;
  b.x = 180;
  b.y = 190;
  for (const phase of [2, 3] as const)
    for (let bottom = 0; bottom < 4; bottom++) {
      b.phase = phase;
      b.cannons.forEach((p, i) => {
        p.aimAngle = ((i - bottom) * Math.PI) / 2;
        p.x = 180 + Math.sin(p.aimAngle) * 70;
        p.y = 190 + Math.cos(p.aimAngle) * 70;
      });
      const rays = bossAttackPlan(b, { x: 180, y: 540 }),
        core = rays.find((r) => r.mount === null && Math.abs(r.angle) < 0.001)!,
        rim = rays.find((r) => r.mount === bottom)!;
      for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++) {
          const gap = Math.abs(
            70 - 150 * (rim.delay - core.delay + (r - c) * 0.22),
          );
          expect(gap).toBeGreaterThan(12);
        }
    }
});

it("polar core clearly requires two armour breaks and opens only between ring shifts", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, skin: "polarRadar", at: 0 },
  });
  m.start();
  for (let i = 0; i < 204; i++) m.update(1 / 60);
  const b = m.boss!;
  const hp = b.hp;
  const shoot = (id: number) => {
    m.bullets.push({ id, x: b.x, y: b.y, active: true, damage: 10 });
    m.update(0);
  };
  expect(bossCoreState(b)).toBe("armored");
  shoot(10001);
  expect(b.hp).toBe(hp);
  expect(b.shieldHitUntil).toBeGreaterThan(m.time);
  b.cannons[0].active = false;
  shoot(10002);
  expect(b.hp).toBe(hp);
  b.cannons[1].active = false;
  expect(bossCoreState(b)).toBe("open");
  shoot(10003);
  expect(b.hp).toBe(hp - 10);
  b.age = 2.7;
  m.update(0);
  expect(bossCoreState(b)).toBe("indexing");
  shoot(10004);
  expect(b.hp).toBe(hp - 10);
});
it("armour counterplay uses visible reachable parts and returns to the core after two breaks", () => {
  const b = {
    active: true,
    skin: "polarRadar",
    x: 180,
    y: 190,
    cannons: [
      { active: true, x: 145, y: 250 },
      { active: true, x: 240, y: 225 },
      { active: true, x: 180, y: 120 },
      { active: true, x: 110, y: 160 },
    ],
  };
  expect(bossAimGoal(b, 180)).toBe(145);
  b.cannons[0].active = false;
  expect(bossAimGoal(b, 180)).toBe(240);
  b.cannons[1].active = false;
  expect(bossAimGoal(b, 180)).toBe(180);
  expect(bossAimGoal(null, 180)).toBeUndefined();
});

it("polar phase escalation requires two, then one, then the last surviving generator", () => {
  const b = {
    skin: "polarRadar" as const,
    phase: 1 as 1 | 2 | 3,
    cannons: [
      { active: false },
      { active: false },
      { active: true },
      { active: true },
    ],
    motion: { state: "locked-ring" },
  };
  expect(bossCoreState(b)).toBe("open");
  b.phase = 2;
  expect(bossCoreState(b)).toBe("armored");
  b.cannons[2].active = false;
  expect(bossCoreState(b)).toBe("open");
  b.phase = 3;
  expect(bossCoreState(b)).toBe("armored");
  b.cannons[3].active = false;
  expect(bossCoreState(b)).toBe("open");
});

// Geometry fixture: force a mid-fight phase announcement at different points
// in each movement cycle. This does not stand in for normal victory tests.
describe.each(skins)("%s phase-transition volley budget", (skin) => {
  it.each([2, 3] as const)(
    "finishes every accepted four-pulse volley after entering phase %i",
    (phase) => {
      let observed = 0;
      for (const transitionAt of [3.1, 3.8, 4.4, 5.2, 6.1, 7.3, 8.2, 9.4]) {
        const m = new FlightModel({
          ...stage01,
          duration: 60,
          waves: [],
          pickups: [],
          boss: { ...stage01.boss!, skin, at: 0, fireEvery: 1.2 },
        });
        m.start();
        m.invincible = 100;
        while (m.time < transitionAt) m.update(1 / 60);
        m.boss!.hp = m.boss!.maxHp * (phase === 2 ? 0.5 : 0.2);
        m.update(1 / 60);
        let cycle = m.boss!.attackCycle;
        let plan: { count: number; tail: number } | undefined;
        let volley: { count: number; before: number; end: number } | undefined;
        for (let frame = 0; frame < 14 * 60; frame++) {
          const b = m.boss!;
          if (b.attackWarning > 0 && b.attackPlan?.length) {
            plan = {
              count: b.attackPlan.length * 4,
              tail: Math.max(...b.attackPlan.map((ray) => ray.delay)) + 0.66,
            };
          }
          const before = m.emittedBossShots;
          m.update(1 / 60);
          if (b.attackCycle !== cycle) {
            if (plan)
              volley = {
                count: plan.count,
                before,
                end: m.time + plan.tail + 1 / 30,
              };
            cycle = b.attackCycle;
          }
          if (volley && m.time >= volley.end) {
            expect(
              m.emittedBossShots - volley.before,
              `phase ${phase} transition at ${transitionAt}s`,
            ).toBe(volley.count);
            observed++;
            volley = undefined;
          }
        }
      }
      expect(observed).toBeGreaterThan(20);
    },
  );
});
