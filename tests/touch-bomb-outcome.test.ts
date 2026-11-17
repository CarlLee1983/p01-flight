import { expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
function bossFixture(hp: number) {
  const model = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, at: 0, hp, sideCannonHp: undefined },
  });
  model.start();
  model.update(1 / 60);
  return model;
}
it("nonlethal secondary-touch bomb continues playing", () => {
  const m = bossFixture(100);
  expect(m.useBomb()).toBe(true);
  expect(m.bombs).toBe(1);
  expect(m.mode).toBe("playing");
  expect(m.boss?.active).toBe(true);
  expect(m.bossDefeated).toBe(false);
});
it("lethal bomb immediately transitions to won before the UI cleanup frame", () => {
  const m = bossFixture(18);
  expect(m.hp).toBe(3);
  expect(m.useBomb()).toBe(true);
  expect(m.mode).toBe("won");
  expect(m.bossDefeated).toBe(true);
  expect(m.boss?.active).toBe(false);
  expect(m.bombs).toBe(1);
  expect(m.useBomb()).toBe(false);
  expect(m.bombs).toBe(1);
});
