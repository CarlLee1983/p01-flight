import { expect, it } from "vitest";
import { chooseAction, type Steering } from "./keyboard-policy";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { advanceFrame } from "../src/game/frame-step";
it("reverses after overshoot rather than holding toward the edge", () => {
  expect(
    chooseAction(
      { player: { x: 208, y: 540 }, hostileProjectiles: [] },
      1,
      180,
    ),
  ).toBe(-1);
  expect(
    chooseAction(
      { player: { x: 342, y: 540 }, hostileProjectiles: [] },
      1,
      180,
    ),
  ).toBe(-1);
  expect(
    chooseAction(
      { player: { x: 18, y: 540 }, hostileProjectiles: [] },
      -1,
      180,
    ),
  ).toBe(1);
});
it("does not cross a projectile merely to reach a goal", () => {
  expect(
    chooseAction(
      {
        player: { x: 90, y: 540 },
        hostileProjectiles: [{ x: 138, y: 512, vx: 0, vy: 140 }],
      },
      0,
      180,
    ),
  ).toBe(0);
});
it.each([10, 15, 30, 60, 120])(
  "goal-aware full normal-health shore sortie at %iFPS",
  (fps) => {
    const m = new FlightModel(stage01);
    m.start();
    let phase = "wait",
      shore: (typeof m.enemies)[number] | undefined;
    let held: Steering = 0,
      next = 0,
      samples = 0,
      b1 = false,
      b2 = false,
      kill = false;
    for (let frame = 0; frame < 175 * fps && m.mode === "playing"; frame++) {
      if (m.time >= 140 && !b1) b1 = m.useBomb();
      if (m.time >= 146 && !b2) b2 = m.useBomb();
      if (m.time >= 70 && phase === "wait") {
        shore = m.enemies.find(
          (e) =>
            e.active &&
            e.behavior === "groundBattery" &&
            (e.telegraph ?? 0) > 0,
        );
        if (shore) phase = "attack";
      }
      if (phase === "attack" && !shore?.active) {
        kill = (shore?.hp ?? 1) <= 0;
        phase = "back";
      }
      if (phase === "back" && Math.abs(m.player.x - 180) < 12) phase = "done";
      if (m.time >= next) {
        held = chooseAction(
          {
            player: m.player,
            hostileProjectiles: m.enemyBullets.filter((b) => b.active),
          },
          held,
          phase === "attack" ? shore!.x : phase === "back" ? 180 : undefined,
        );
        next = m.time + [0.05, 0.12, 0.08, 0.18, 0.1][samples++ % 5];
      }
      advanceFrame(m, 1 / fps, held, 0, true, false);
    }
    console.log("keyboard goal route", {
      fps,
      mode: m.mode,
      hp: m.hp,
      phase,
      kill,
    });
    expect(m.mode).toBe("won");
    expect(phase).toBe("done");
    expect(kill).toBe(true);
    expect(m.bombs).toBe(0);
  },
);
