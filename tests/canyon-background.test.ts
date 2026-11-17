import { expect, it } from "vitest";
import { canyonLayout } from "../src/game/canyon-background";
it("keeps scrolling coverage and transitions into an open basin before Boss entry", () => {
  for (let t = 0; t < 190; t += 0.1) {
    const layout = canyonLayout(t);
    expect(layout.tileY[0]).toBeLessThanOrEqual(0);
    expect(layout.tileY[2] + 450).toBeGreaterThanOrEqual(640);
    expect(layout.tileY[1] - layout.tileY[0]).toBeCloseTo(450);
    expect(layout.basinMix).toBeGreaterThanOrEqual(0);
    expect(layout.basinMix).toBeLessThanOrEqual(1);
  }
  expect(canyonLayout(135).basinMix).toBe(0);
  expect(canyonLayout(140.5).basinMix).toBeCloseTo(0.5);
  expect(canyonLayout(145).basinMix).toBe(1);
  expect(canyonLayout(29).landmarks[0].y).toBe(-160);
});
