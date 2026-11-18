import { it, expect } from "vitest";
import { rocketPresentation, ROCKET_ART } from "../src/game/hostile-rocket";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import source from "../docs/hostile-missile-art.json";
it("enemy missile is a tiny original bitmap with the documented content hash", () => {
  const bytes = readFileSync(source.path);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  expect(bytes.length).toBeLessThan(4096);
  expect(ROCKET_ART).toMatchObject({ width: 8, height: 18 });
});
it("flame flickers behind actual velocity without any future trajectory or collision mutation", () => {
  for (let a = -Math.PI; a <= Math.PI; a += Math.PI / 8) {
    const shot = {
      id: 7,
      x: 180,
      y: 220,
      vx: Math.sin(a) * 150,
      vy: Math.cos(a) * 150,
    };
    const original = { ...shot };
    const p = rocketPresentation(shot, 1),
      next = rocketPresentation(shot, 1.04);
    expect(shot).toEqual(original);
    expect(p.outer).not.toEqual(next.outer);
    for (const point of [...p.outer, ...p.inner]) {
      const behind =
        (point.x - shot.x) * Math.sin(a) + (point.y - shot.y) * Math.cos(a);
      expect(behind).toBeLessThan(-7.9);
      expect(Math.hypot(point.x - shot.x, point.y - shot.y)).toBeLessThan(18);
    }
    expect(-Math.sin((p.angle * Math.PI) / 180)).toBeCloseTo(Math.sin(a));
    expect(Math.cos((p.angle * Math.PI) / 180)).toBeCloseTo(Math.cos(a));
  }
});
