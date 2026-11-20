import { it, expect } from "vitest";
import {
  rocketPresentation,
  createRocketPose,
  ROCKET_ART,
} from "../src/game/hostile-rocket";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import source from "../docs/hostile-missile-art.json";
it("enemy missile is a tiny original bitmap with the documented content hash", () => {
  const bytes = readFileSync(source.path);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  expect(bytes.length).toBeLessThan(4096);
  expect(ROCKET_ART).toMatchObject({ width: 11, height: 26 });
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
      expect(behind).toBeLessThan(-ROCKET_ART.nozzle + 0.1);
      expect(Math.hypot(point.x - shot.x, point.y - shot.y)).toBeLessThan(25);
    }
    expect(-Math.sin((p.angle * Math.PI) / 180)).toBeCloseTo(Math.sin(a));
    expect(Math.cos((p.angle * Math.PI) / 180)).toBeCloseTo(Math.cos(a));
  }
});

it("renderer scratch reuses every exhaust vertex while leaving the shot untouched", () => {
  const scratch = createRocketPose(),
    outer = scratch.outer,
    inner = scratch.inner;
  const vertices = [...outer, ...inner],
    nozzle = scratch.nozzle;
  const shot = { id: 1, x: 30, y: 40, vx: 60, vy: 120 },
    original = { ...shot };
  for (let n = 0; n < 1000; n++) {
    expect(rocketPresentation(shot, n / 60, scratch)).toBe(scratch);
    expect(scratch.outer).toBe(outer);
    expect(scratch.inner).toBe(inner);
    expect(scratch.nozzle).toBe(nozzle);
    for (let j = 0; j < 3; j++) {
      expect(outer[j]).toBe(vertices[j]);
      expect(inner[j]).toBe(vertices[j + 3]);
    }
  }
  expect(shot).toEqual(original);
});
