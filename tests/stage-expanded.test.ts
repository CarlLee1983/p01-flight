import { dodgeDirection } from "./dodge-route";
import { it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
it.each([30, 60, 120])(
  "ground-interception route clears with all three weapons at %i FPS",
  (fps) => {
    for (const weapon of ["spread", "beam", "missile"] as const) {
      const m = new FlightModel(stage01);
      m.start();
      let phase = "wait",
        id = 0,
        x = 0,
        sw = false,
        b1 = false,
        b2 = false;
      let maxE = 0,
        maxB = 0,
        midDamage = 0;
      const seenAir = new Set<number>();
      const hits: unknown[] = [];
      let hp = 3;
      for (let i = 0; i < 171 * fps; i++) {
        let dx = 0;
        if (m.time > 70 && phase === "wait") {
          const e = m.enemies.find(
            (e) =>
              e.active &&
              e.behavior === "groundBattery" &&
              (e.telegraph ?? 0) > 0,
          );
          if (e) {
            id = e.id;
            x = e.x;
            phase = "approach";
          }
        }
        if (phase === "approach") {
          if (!m.enemies.find((e) => e.id === id)?.active) phase = "return";
          else if (Math.abs(x - m.player.x) > 18)
            dx = Math.sign(x - m.player.x);
        }
        if (phase === "return") {
          if (Math.abs(180 - m.player.x) > 12) dx = Math.sign(180 - m.player.x);
          else phase = "done";
        }
        if (!sw && m.time >= 125) {
          midDamage = m.damageCount;
          if (weapon !== "spread") m.switchWeapon();
          if (weapon === "missile") m.switchWeapon();
          sw = true;
        }
        if (!b1 && m.time >= 140) b1 = m.useBomb();
        if (!b2 && m.time >= 146) b2 = m.useBomb();
        if (weapon === "missile" && m.time >= 149 && m.time < 149.5) dx = -1;
        m.update(
          1 / fps,
          dodgeDirection(m, dx),
          0,
          true,
          weapon === "missile" && m.time >= 125,
        );
        for (const e of m.enemies)
          if (
            e.active &&
            !["groundBattery", "groundDepot", "gatekeeper"].includes(
              e.behavior ?? "",
            ) &&
            e.y >= 80 &&
            e.x >= 0 &&
            e.x <= 360
          )
            seenAir.add(e.id);
        maxE = Math.max(maxE, m.enemies.filter((e) => e.active).length);
        maxB = Math.max(maxB, m.enemyBullets.filter((e) => e.active).length);
        if (m.hp !== hp) {
          hits.push([m.time.toFixed(2), m.hp]);
          hp = m.hp;
        }
      }
      console.log(
        JSON.stringify({
          fps,
          weapon,
          entered: seenAir.size,
          countedEntered: m.enteredAir,
          spawned: m.spawnedAir,
          mode: m.mode,
          time: m.time,
          hp: m.hp,
          phase,
          maxE,
          maxB,
          hits,
        }),
      );
      expect(m.mode).toBe("won");
      expect(m.spawnedAir).toBe(405);
      expect(m.enteredAir).toBe(405);
      expect(
        m.enteredAir -
          stage01.waves.filter((w) => w.behavior === "carrier").length,
      ).toBeGreaterThanOrEqual(396);
      expect(seenAir.size).toBeGreaterThanOrEqual(396);
      expect(m.time).toBeGreaterThan(145);
      expect(m.time).toBeLessThan(155);
      expect(phase).toBe("done");
      expect(m.damageCount).toBeGreaterThan(0);
      expect(midDamage).toBeGreaterThan(0);
      expect(maxE).toBeLessThanOrEqual(18);
      expect(maxB).toBeLessThanOrEqual(48);
    }
  },
);

it.each([30, 60, 120])(
  "full schedule remains readable even if enemies survive at %i FPS",
  (fps) => {
    const m = new FlightModel(stage01);
    m.start();
    // Isolate density/exit timing, not a normal-play victory claim.
    m.invincible = 200;
    let maxE = 0,
      maxB = 0;
    for (let i = 0; i < 125 * fps; i++) {
      m.update(1 / fps);
      maxE = Math.max(maxE, m.enemies.filter((e) => e.active).length);
      maxB = Math.max(maxB, m.enemyBullets.filter((e) => e.active).length);
    }
    console.log(
      "schedule peaks",
      fps,
      maxE,
      maxB,
      "pooled",
      m.enemies.length,
      m.enemyBullets.length,
    );
    expect(m.enemies.length).toBeLessThanOrEqual(32);
    expect(m.enemyBullets.length).toBeLessThanOrEqual(40);
    expect(maxE).toBeLessThanOrEqual(32);
    expect(maxB).toBeLessThanOrEqual(40);
  },
);
it("new route uses distinct roles and fixed-time supplies instead of extending Boss health", () => {
  const added = stage01.waves.filter((w) => w.at >= 62);
  expect(added.length).toBe(228);
  expect(new Set(added.map((w) => w.behavior))).toEqual(
    new Set([
      "weave",
      "brakeRaider",
      "hookWing",
      "groundBattery",
      "carrier",
      "escort",
      "cross",
      "heavy",
      "dive",
      "straight",
    ]),
  );
  expect(stage01.boss?.hp).toBe(400);
  expect(
    stage01.pickups
      ?.filter((p) => p.kind === "heal" && p.at >= 62)
      .map((p) => p.at),
  ).toEqual([74, 96, 118]);
  expect(
    stage01.waves
      .filter((w) => w.behavior === "groundBattery")
      .map((w) => w.at),
  ).toEqual([32, 32, 70, 71.2]);
});

it("provides 405 airborne opponents with bounded firing roles, not phantom ground/boss counts", () => {
  const counts: Record<string, number> = {};
  for (const wave of stage01.waves) {
    counts[wave.behavior ?? "straight"] =
      (counts[wave.behavior ?? "straight"] ?? 0) + 1;
  }
  expect(counts).toEqual({
    straight: 112,
    weave: 128,
    brakeRaider: 6,
    hookWing: 6,
    cross: 125,
    escort: 12,
    carrier: 6,
    dive: 8,
    heavy: 2,
    groundBattery: 4,
    groundDepot: 1,
    gatekeeper: 1,
  });
  // Even excluding non-combat supply aircraft there are 399 airborne opponents.
  expect(
    stage01.waves.filter(
      (w) =>
        !["groundBattery", "groundDepot", "gatekeeper", "carrier"].includes(
          w.behavior ?? "",
        ),
    ).length,
  ).toBe(399);
  expect(
    stage01.waves.filter((w) => w.points === 80 && w.fireEvery).length,
  ).toBe(92);
});

it("aircraft must enter the playfield before bullets, missiles or bombs can hit them", () => {
  const m = new FlightModel({
    ...stage01,
    waves: [{ at: 0, x: 180, speed: 100, hp: 1, points: 80 }],
    pickups: [],
    boss: undefined,
  });
  m.start();
  m.update(1 / 60);
  const e = m.enemies[0];
  const id = e.id;
  m.bullets.push({ id: 999, x: e.x, y: e.y + 9, active: true, damage: 10 });
  m.update(1 / 60);
  expect(e.active).toBe(true);
  m.useBomb();
  expect(e.active).toBe(true);
  m.weaponMode = "missile";
  for (let i = 0; i < 20; i++) m.update(1 / 60, 0, 0, true);
  expect(m.bullets.some((b) => b.targetId === id)).toBe(false);
  expect(m.spawnedAir).toBe(1);
  expect(m.enteredAir).toBe(0);
  for (let i = 0; i < 65; i++) m.update(1 / 60, 0, 0, true);
  expect(m.enteredAir).toBe(1);
  expect(e.active).toBe(false);
  m.start();
  expect(m.enteredAir).toBe(0);
  expect(m.spawnedAir).toBe(0);
});
