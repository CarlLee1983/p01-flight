import { expect, it } from "vitest";
import { stage01 } from "../src/data/stage";
import { FlightModel } from "../src/game/model";

it.each([30, 60, 120])(
  "armed wing flights fire repeatedly while visible at %i FPS",
  (fps) => {
    const m = new FlightModel(stage01);
    m.start();
    // Isolated outgoing-fire audit, not a claim that stationary play survives.
    m.invincible = 200;
    const shots = new Map<number, number>();
    let peak = 0;
    for (let i = 0; i < 121 * fps; i++) {
      m.update(1 / fps);
      for (const e of m.enemies) {
        if (e.points === 80 && e.shotsFired) shots.set(e.id, e.shotsFired);
      }
      peak = Math.max(peak, m.enemyBullets.filter((b) => b.active).length);
    }
    const total = [...shots.values()].reduce((a, b) => a + b, 0);
    console.log("wing-flight outgoing fire", {
      fps,
      aircraft: shots.size,
      total,
      peak,
    });
    expect(shots.size).toBe(92);
    expect(total).toBeGreaterThanOrEqual(120);
    expect(peak).toBeLessThanOrEqual(40);
    expect(m.enemyBullets.some((b) => b.active)).toBe(false);
    expect(
      stage01.waves
        .filter((w) => w.points === 80 && w.at >= 113)
        .every((w) => !w.fireEvery),
    ).toBe(true);
  },
);
