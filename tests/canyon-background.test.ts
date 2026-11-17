import { expect, it } from "vitest";
import { canyonBanks } from "../src/game/canyon-background";
it("canyon banks stay smooth, keep roads on land and preserve readable combat water", () => {
  for (let world = -700; world < 6500; world += 1) {
    const a = canyonBanks(world),
      b = canyonBanks(world + 1);
    expect(a.left).toBeGreaterThan(65);
    expect(a.right).toBeLessThan(295);
    expect(a.right - a.left).toBeGreaterThan(165);
    expect(Math.abs(a.left - b.left)).toBeLessThan(0.1);
    expect(Math.abs(a.right - b.right)).toBeLessThan(0.1);
  }
});
