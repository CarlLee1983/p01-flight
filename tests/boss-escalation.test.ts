import { expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { bossShotOrigin } from "../src/game/boss-muzzles";
import { bossAttackPlan } from "../src/game/boss-attacks";
import { bossPose, bossMount, bossCoreContains } from "../src/game/boss-rigs";

it("polar carrier unfolds across phases and shifts diagonally only before firing", () => {
  const poses = ([1, 2, 3] as const).map((phase) =>
    bossPose("polarRadar", 7.3, phase, 5),
  );
  expect(poses.map((p) => p.armourSpanX)).toEqual([64, 76, 82]);
  expect(poses.map((p) => p.armourSpanY)).toEqual([40, 62, 76]);
  const before = bossPose("polarRadar", 2.6, 3, 5),
    after = bossPose("polarRadar", 3.400001, 3, 5);
  expect(before.canFire).toBe(false);
  expect(after.canFire).toBe(true);
  expect(Math.abs(after.x - before.x)).toBeCloseTo(100);
  expect(Math.abs(after.y - before.y)).toBeCloseTo(60);
  for (const p of poses)
    for (let i = 0; i < 4; i++) {
      const mount = bossMount("polarRadar", i, p);
      expect(Number.isFinite(mount.x + mount.y + mount.rotation)).toBe(true);
    }
  expect(
    bossCoreContains({ skin: "polarRadar", x: 180, y: 190 }, 180, 190),
  ).toBe(true);
  expect(
    bossCoreContains({ skin: "polarRadar", x: 180, y: 190 }, 220, 190),
  ).toBe(false);
});
it("river leading launcher rotates among surviving deck guns, while escorts cover a side lane", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, skin: "riverFortress", at: 0 },
  });
  m.start();
  m.update(1 / 60);
  const b = m.boss!;
  b.phase = 2;
  for (let cycle = 0; cycle < 3; cycle++) {
    b.attackCycle = cycle;
    const rays = bossAttackPlan(b, { x: 180, y: 540 });
    expect([
      ...new Set(rays.filter((r) => r.style === "rocket").map((r) => r.mount)),
    ]).toEqual([cycle]);
    expect(rays.filter((r) => r.style === "shell")).toHaveLength(4);
  }
  b.cannons[0].active = false;
  b.attackCycle = 0;
  expect(
    bossAttackPlan(b, { x: 180, y: 540 })
      .filter((r) => r.style === "rocket")
      .every((r) => r.mount === 1),
  ).toBe(true);
});
it("polar final phase commits one bait rocket before a delayed split plasma fan", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, skin: "polarRadar", at: 0 },
  });
  m.start();
  m.update(1 / 60);
  const b = m.boss!;
  b.phase = 3;
  b.cannons.forEach((p) => (p.active = false));
  const rays = bossAttackPlan(b, { x: 180, y: 540 }),
    rocket = rays.filter((r) => r.style === "rocket"),
    plasma = rays.filter((r) => r.style === "plasma");
  expect(rocket).toHaveLength(1);
  expect(rocket[0].delay).toBe(0);
  expect(plasma).toHaveLength(4);
  expect(plasma.every((r) => r.delay === 0.11)).toBe(true);
  const centre = rocket[0].angle;
  expect(plasma.every((r) => Math.abs(r.angle - centre) >= 0.2999)).toBe(true);
});

it("larger river rockets diverge instead of sharing a six-pixel dual-barrel lane", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, skin: "riverFortress", at: 0 },
  });
  m.start();
  m.update(1 / 60);
  const b = m.boss!;
  b.phase = 3;
  for (let cycle = 0; cycle < 3; cycle++) {
    b.attackCycle = cycle;
    const rays = bossAttackPlan(b, { x: 180, y: 540 }).filter(
      (r) => r.style === "rocket",
    );
    const angles = rays.map((r) => r.angle).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++)
      expect(angles[i] - angles[i - 1]).toBeGreaterThan(0.22);
  }
});

it("polar phase three alternates an aimed rocket and a timed gate without raising projectile count", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, skin: "polarRadar", at: 0 },
  });
  m.start();
  m.update(1 / 60);
  const b = m.boss!;
  b.phase = 3;
  b.cannons.forEach((c) => {
    c.active = false;
  });
  const player = { x: 180, y: 540 };
  const first = bossAttackPlan(b, player);
  b.attackCycle = 1;
  const second = bossAttackPlan(b, player);
  expect(second).toHaveLength(first.length);
  const gate = second.filter((ray) => ray.style === "rocket");
  expect(gate).toHaveLength(2);
  expect(gate.every((ray) => ray.delay === 0.11)).toBe(true);
  expect(
    bossShotOrigin(b, gate[1]).x - bossShotOrigin(b, gate[0]).x,
  ).toBeCloseTo(24);
  const middle = second[0];
  expect(middle).toMatchObject({ style: "plasma", delay: 0 });
  expect(middle.angle - gate[0].angle).toBeCloseTo(0.24);
  expect(gate[1].angle - middle.angle).toBeCloseTo(0.24);
  expect(second.every((ray) => Number.isFinite(ray.angle))).toBe(true);
});
