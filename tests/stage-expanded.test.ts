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
        if (weapon === "missile" && m.time >= 150 && m.time < 150.3) dx = 1;
        m.update(1 / fps, dx, 0, true, weapon === "missile" && m.time >= 125);
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
      expect(m.time).toBeGreaterThan(145);
      expect(m.time).toBeLessThan(155);
      expect(phase).toBe("done");
      expect(m.damageCount).toBeGreaterThan(0);
      expect(midDamage).toBeGreaterThan(0);
      expect(maxE).toBeLessThanOrEqual(12);
      expect(maxB).toBeLessThanOrEqual(24);
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
      maxB = 0,
      midDamage = 0;
    for (let i = 0; i < 125 * fps; i++) {
      m.update(1 / fps);
      maxE = Math.max(maxE, m.enemies.filter((e) => e.active).length);
      maxB = Math.max(maxB, m.enemyBullets.filter((e) => e.active).length);
    }
    console.log("schedule peaks", fps, maxE, maxB);
    expect(maxE).toBeLessThanOrEqual(16);
    expect(maxB).toBeLessThanOrEqual(32);
  },
);
it("new route uses distinct roles and fixed-time supplies instead of extending Boss health", () => {
  const added = stage01.waves.filter((w) => w.at >= 62);
  expect(added.length).toBe(48);
  expect(new Set(added.map((w) => w.behavior))).toEqual(
    new Set([
      "weave",
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
