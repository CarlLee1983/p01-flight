import { it, expect } from "vitest";
import {
  bossChargeSources,
  CANNON_ART,
  PRESENTATION_LAYERS,
} from "../src/game/combat-presentation";
import { bossMuzzle } from "../src/game/boss-muzzles";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
const boss = () => {
  const m = new FlightModel({
    ...stage01,
    waves: [],
    pickups: [],
    boss: { ...stage01.boss!, at: 0 },
  });
  m.start();
  m.update(1 / 60);
  return m.boss!;
};
it("opaque HUD plate covers combat sprites while labels stay above it", () => {
  expect(PRESENTATION_LAYERS.hud).toBeGreaterThan(
    PRESENTATION_LAYERS.combatMax,
  );
  expect(PRESENTATION_LAYERS.text).toBeGreaterThan(PRESENTATION_LAYERS.hud);
});
it.each([2, 3, 5])(
  "charges each actual muzzle once for %i forecast rays",
  (count) => {
    const b = boss();
    b.attackAngles = Array.from({ length: count }, (_, i) => i * 0.1);
    const sources = bossChargeSources(b);
    expect(sources).toHaveLength(Math.min(count, 3));
    for (let i = 0; i < count; i++) {
      const m = bossMuzzle(b, i, count);
      expect(sources).toContainEqual({ x: m.x, y: m.y });
    }
    expect(b.attackAngles).toHaveLength(count); // Dedupe sources, never the forecast rays.
  },
);
it("broken side pods have no charge indicator, central fan remains", () => {
  const b = boss();
  b.attackAngles = [-0.4, -0.2, 0, 0.2, 0.4];
  b.cannons.forEach((c) => (c.active = false));
  const core = bossMuzzle(b, 2, 5);
  expect(bossChargeSources(b)).toEqual([{ x: core.x, y: core.y }]);
});
it("new cannon art keeps the existing barrel endpoint, not a cosmetic offset", () => {
  const b = boss();
  const m = bossMuzzle(b, 0, 2);
  expect(Math.hypot(m.x - b.cannons[0].x, m.y - b.cannons[0].y)).toBeCloseTo(
    CANNON_ART.muzzleY,
  );
  expect(CANNON_ART.height / 2 - 2).toBe(CANNON_ART.muzzleY);
});

it("falling pickup labels stay behind hostile bullets and HUD", () => {
  expect(PRESENTATION_LAYERS.pickupLabel).toBeLessThan(
    PRESENTATION_LAYERS.projectiles,
  );
  expect(PRESENTATION_LAYERS.projectiles).toBeLessThan(PRESENTATION_LAYERS.hud);
});
