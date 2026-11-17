import { expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import type { StageConfig } from "../src/data/stage";
const config: StageConfig = {
  id: "test",
  title: "test",
  duration: 20,
  width: 360,
  height: 640,
  waves: [
    { at: 0, x: 180, speed: 100, hp: 2, points: 1 },
    { at: 0, x: 30, speed: 32, hp: 2, points: 1, behavior: "groundBattery" },
    { at: 0, x: 50, speed: 32, hp: 2, points: 1, behavior: "groundDepot" },
    { at: 0, x: 180, speed: 100, hp: 2, points: 1, behavior: "gatekeeper" },
  ],
};
it("counts real airborne entry once, excludes ground and patrol and resets on restart", () => {
  const m = new FlightModel(config);
  m.start();
  m.update(1 / 60, 0, 0, false);
  expect(m.spawnedAir).toBe(1);
  expect(m.enteredAir).toBe(0);
  for (let i = 0; i < 120; i++) m.update(1 / 60, 0, 0, false);
  expect(m.enteredAir).toBe(1);
  m.start();
  expect(m.spawnedAir).toBe(0);
  expect(m.enteredAir).toBe(0);
});
