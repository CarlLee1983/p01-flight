import { expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { advanceFrame } from "../src/game/frame-step";
import { chooseAction, clearance, type Steering } from "./keyboard-policy";

it("focus clearance models the actual 100px/s rather than normal 240px/s", () => {
  const s = {
    player: { x: 90, y: 540 },
    hostileProjectiles: [{ x: 150, y: 540, vx: 0, vy: 0 }],
  };
  expect(clearance({ ...s, focus: true }, 1)).toBeCloseTo(25);
  expect(clearance(s, 1)).toBe(0);
});

it.each([10, 15, 30, 60, 120])(
  "shore-sortie focused goal input at %iFPS with 100–200ms RPC latency",
  (fps) => {
    const m = new FlightModel(stage01);
    m.start();
    let held: Steering = 0,
      calls = 0;
    const tick = (seconds: number) => {
      for (let left = seconds; left > 1e-8; ) {
        const dt = Math.min(left, 1 / fps);
        advanceFrame(m, dt, held, 0, true, true);
        left -= dt;
      }
    };
    const rpc = () => tick([0.1, 0.2, 0.15, 0.2, 0.1][calls++ % 5]);
    const read = () => {
      const s = {
        player: { ...m.player },
        hostileProjectiles: m.enemyBullets
          .filter((b) => b.active)
          .map((b) => ({ ...b })),
        focus: true,
      };
      rpc();
      return s;
    };
    const release = () => {
      if (held) {
        rpc();
        held = 0;
      }
    };
    while (m.time < 70 && m.mode === "playing") {
      held = chooseAction(
        {
          player: m.player,
          hostileProjectiles: m.enemyBullets.filter((b) => b.active),
        },
        held,
      );
      advanceFrame(m, 1 / fps, held, 0, true, false);
    }
    held = 0;
    while (
      !m.enemies.some(
        (e) =>
          e.active && e.behavior === "groundBattery" && (e.telegraph ?? 0) > 0,
      ) &&
      m.time < 80
    )
      tick(1 / fps);
    const shore = m.enemies.find(
      (e) =>
        e.active && e.behavior === "groundBattery" && (e.telegraph ?? 0) > 0,
    );
    expect(shore).toBeTruthy();
    for (const goal of [shore!.x, 180]) {
      const start = m.time;
      let arrived = false;
      while (m.time - start <= 8 && m.mode === "playing") {
        const s = read();
        if (Math.abs(s.player.x - goal) < 12) {
          release();
          const settled = read();
          if (Math.abs(settled.player.x - goal) < 12) {
            arrived = true;
            break;
          }
          continue;
        }
        const next = chooseAction(s, held, goal);
        if (next !== held) {
          release();
          if (next) {
            rpc();
            held = next;
          }
        }
        tick(0.02);
        release();
      }
      release();

      expect({
        arrived,
        mode: m.mode,
        x: m.player.x,
        elapsed: m.time - start,
      }).toMatchObject({ arrived: true, mode: "playing" });
      expect(m.time - start).toBeLessThanOrEqual(8);
      expect(Math.abs(m.player.x - goal)).toBeLessThan(12);
      expect(m.hp).toBeGreaterThan(0);
      if (goal === shore!.x) {
        const began = m.time;
        while (shore!.active && m.time - began < 8 && m.mode === "playing")
          tick(1 / fps);
        expect(shore!.hp).toBeLessThanOrEqual(0);
      }
    }
    let b1 = false,
      b2 = false;
    while (m.time < 175 && m.mode === "playing") {
      if (m.time >= 140 && !b1) b1 = m.useBomb();
      if (m.time >= 146 && !b2) b2 = m.useBomb();
      held = chooseAction(
        {
          player: m.player,
          hostileProjectiles: m.enemyBullets.filter((b) => b.active),
        },
        held,
      );
      advanceFrame(m, 1 / fps, held, 0, true, false);
    }
    console.log("focused delayed shore route", {
      fps,
      time: m.time,
      hp: m.hp,
      mode: m.mode,
    });
    expect(m.mode).toBe("won");
    expect(m.bombs).toBe(0);
  },
);

it("explicit goal can use a 40px safe corridor without changing optional centering", () => {
  const s = {
    player: { x: 90, y: 540 },
    focus: true,
    hostileProjectiles: [{ x: 165, y: 540, vx: 0, vy: 0 }],
  };
  expect(clearance(s, 1)).toBeCloseTo(40);
  expect(chooseAction(s, 0, 180)).toBe(1);
  expect(chooseAction(s)).toBe(0);
});
