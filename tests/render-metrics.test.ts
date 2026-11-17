import { describe, it, expect } from "vitest";
import { RenderMetrics } from "../src/game/render-metrics";
describe("render metrics", () => {
  it("counts concurrent active population rather than total stage waves and excludes ground from air", () => {
    const metrics = new RenderMetrics();
    const pop = {
      enemies: [
        { active: true, behavior: "scout" },
        { active: true, behavior: "groundBattery" },
        { active: false, behavior: "heavy" },
      ],
      bullets: [{ active: true }],
      enemyBullets: [{ active: false }, { active: true }],
    };
    const before = JSON.stringify(pop);
    metrics.sample(pop, 4, 8, 2);
    metrics.sample({ enemies: [], bullets: [], enemyBullets: [] }, 1, 8, 4);
    expect(metrics.snapshot()).toMatchObject({
      frames: 2,
      peakEnemies: 2,
      peakAirEnemies: 1,
      peakPlayerBullets: 1,
      peakEnemyBullets: 1,
      peakSprites: 4,
      spritePool: 8,
      meanDrawCpuMs: 3,
      maxDrawCpuMs: 4,
    });
    expect(JSON.stringify(pop)).toBe(before);
    metrics.reset();
    expect(metrics.snapshot()).toMatchObject({
      frames: 0,
      peakEnemies: 0,
      meanDrawCpuMs: 0,
    });
  });
  it("handles long sessions with scalar counters and invalid timing without retaining samples", () => {
    const metrics = new RenderMetrics();
    const population = { enemies: [], bullets: [], enemyBullets: [] };
    const keys = Object.keys(metrics);
    for (let i = 0; i < 20000; i++) metrics.sample(population, 0, 32, NaN);
    expect(Object.keys(metrics)).toEqual(keys);
    expect(Object.values(metrics).every((v) => typeof v === "number")).toBe(
      true,
    );
    expect(metrics.snapshot()).toMatchObject({
      frames: 20000,
      meanDrawCpuMs: 0,
      spritePool: 32,
    });
  });
});
