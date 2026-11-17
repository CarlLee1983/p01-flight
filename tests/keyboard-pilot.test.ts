import { it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { advanceFrame } from "../src/game/frame-step";
import { stage01 } from "../src/data/stage";
import { dodgeInput } from "./e2e/gameplay";
it.each(
  [10, 12, 13, 15, 18, 20, 24, 30, 60].flatMap((fps) =>
    [1, 2].map((delay) => [fps, delay]),
  ),
)(
  "bounded keyboard pilot clears at %i FPS with %i-frame release delay",
  (fps, delay) => {
    const m = new FlightModel(stage01);
    m.start();
    let held = 0,
      x = 180,
      release = 0,
      phase = "wait",
      target: any = null,
      b1 = false,
      b2 = false;
    for (let i = 0; i < 170 * fps && m.mode === "playing"; i++) {
      if (m.time >= 140 && !b1) b1 = m.useBomb();
      if (m.time >= 146 && !b2) b2 = m.useBomb();
      if (m.time >= 70 && phase === "wait") {
        target = m.enemies.find(
          (e) =>
            e.active &&
            e.behavior === "groundBattery" &&
            (e.telegraph ?? 0) > 0,
        );
        if (target) phase = "attack";
      }
      let dx = 0;
      if (phase === "attack") {
        if (!target.active) phase = "back";
        else if (Math.abs(target.x - m.player.x) > 18)
          dx = Math.sign(target.x - m.player.x);
      }
      if (phase === "back") {
        if (Math.abs(m.player.x - 180) > 12) dx = Math.sign(180 - m.player.x);
        else phase = "done";
      }
      if (phase === "wait" || phase === "done") {
        if (held && Math.abs(m.player.x - x) >= 16 && release === 0)
          release = delay;
        if (release > 0) {
          release--;
          if (release === 0) held = 0;
        }
        if (!held) {
          held = dodgeInput(
            {
              player: m.player,
              hostileProjectiles: m.enemyBullets.filter((b) => b.active),
            },
            160,
            44,
          );
          x = m.player.x;
        }
        dx = held;
      }
      advanceFrame(m, 1 / fps, dx, 0, true, false);
    }
    expect(m.mode).toBe("won");
    expect(m.enteredAir).toBe(405);
    expect(m.time).toBeLessThan(155);
    expect(m.bombs).toBe(0);
    console.log({ fps, delay, time: m.time, hp: m.hp, mode: m.mode });
  },
);
