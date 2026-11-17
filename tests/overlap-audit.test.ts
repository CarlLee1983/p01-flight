import { it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
it.each([30, 60, 120])("overlap audit %i", (fps) => {
  const m = new FlightModel(stage01);
  m.start();
  m.invincible = 300;
  let pairFrames = 0,
    bulletFrames = 0,
    peak = 0;
  for (let i = 0; i < 125 * fps; i++) {
    m.update(1 / fps);
    const bs = m.enemyBullets.filter((b) => b.active);
    peak = Math.max(peak, bs.length);
    bulletFrames += bs.length;
    for (let j = 0; j < bs.length; j++)
      for (let k = j + 1; k < bs.length; k++)
        if (Math.hypot(bs[j].x - bs[k].x, bs[j].y - bs[k].y) < 12) pairFrames++;
  }
  expect(pairFrames / bulletFrames).toBeLessThan(0.1);
  expect(pairFrames / fps).toBeLessThan(120);
  expect(m.emittedEnemyShots).toBeGreaterThanOrEqual(490);
  expect(peak).toBeLessThanOrEqual(40);
  console.log({
    fps,
    pairSeconds: pairFrames / fps,
    bulletSeconds: bulletFrames / fps,
    pairRatio: pairFrames / bulletFrames,
    peak,
    shots: m.emittedEnemyShots,
  });
});
