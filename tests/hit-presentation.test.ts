import { it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
it("real hit schedules a brief body flash without changing damage or score", () => {
  const m = new FlightModel({
    ...stage01,
    boss: undefined,
    pickups: [],
    waves: [
      {
        at: 0,
        x: 180,
        speed: 0,
        hp: 20,
        points: 100,
        spawnY: 350,
        behavior: "straight",
      },
    ],
  });
  m.start();
  for (let i = 0; i < 180; i++) {
    m.update(1 / 60, 0, 0, true);
    if (m.effects.some((e) => e.kind === "hit")) break;
  }
  const enemy = m.enemies.find((e) => e.active)!;
  expect(enemy.hp).toBe(19);
  expect(m.score).toBe(0);
  expect(enemy.hitUntil! - m.time).toBeCloseTo(0.055);
  for (let i = 0; i < 8; i++) m.update(1 / 60, 0, 0, false);
  expect(m.time).toBeGreaterThan(enemy.hitUntil!);
});
