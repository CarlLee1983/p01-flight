import { dodgeDirection } from "./dodge-route";
import { it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { advanceFrame } from "../src/game/frame-step";
import { stage01 } from "../src/data/stage";
it.each([10, 15, 20, 30, 60])(
  "render-frame catch-up clears normal three-weapon route at %i FPS",
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
        if (weapon === "missile" && m.time >= 149 && m.time < 149.5) dx = 1;
        if (m.boss?.active) dx = dodgeDirection(m, dx);
        advanceFrame(
          m,
          1 / fps,
          dx,
          0,
          true,
          weapon === "missile" && m.time >= 125 && dx === 0,
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
          seen: seenAir.size,
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
