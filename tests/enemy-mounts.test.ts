import { expect, it } from "vitest";
import { enemyBank, enemyMount } from "../src/game/enemy-mounts";
it("fixed mounts match cohesive authored weapon ends", () => {
  expect(enemyMount({ x: 180, y: 150, behavior: "escort" }, 0)).toEqual({
    x: 180,
    y: 170,
  });
  expect(enemyMount({ x: 180, y: 150, behavior: "gatekeeper" }, 0)).toEqual({
    x: 219,
    y: 182,
  });
  expect(enemyMount({ x: 180, y: 150, behavior: "heavy" }, 1)).toEqual({
    x: 180,
    y: 170,
  });
});
it("strafing hull stays aligned while local emitter follows the existing swivelling socket", () => {
  for (const behavior of ["cross", "weave"] as const) {
    const e = {
      x: 180,
      y: 120,
      behavior,
      direction: 1,
      age: 0.5,
      attackAngles: [-0.2, 0.3],
    };
    expect(enemyBank(e)).toBe(0);
    expect(enemyMount(e, 0)).toEqual({
      x: 180 - Math.cos(-0.2) * 9,
      y: 140 + Math.sin(-0.2) * 9,
    });
  }
  expect(enemyBank({ behavior: "dive", diveAngle: 1 })).not.toBe(0);
});
