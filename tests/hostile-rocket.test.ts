import { it, expect, vi } from "vitest";
import {
  rocketPresentation,
  createRocketPose,
  ROCKET_ART,
  ROCKET_RENDER,
  createRocketTexture,
} from "../src/game/hostile-rocket";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import source from "../docs/hostile-missile-art.json";
it("legacy enemy missile bitmap retains its documented content hash", () => {
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

it("rasterizes the rim once and reuses one cached texture across repeated draws", () => {
  const keys = new Set<string>([ROCKET_ART.key]);
  const ctx = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    globalCompositeOperation: "source-over",
    fillStyle: "",
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const makeCanvas = vi.fn(() => canvas as unknown as HTMLCanvasElement);
  const source = {};
  const scene = {
    textures: {
      exists: (key: string) => keys.has(key),
      get: () => ({ getSourceImage: () => source }),
      addCanvas: vi.fn((key: string) => keys.add(key)),
    },
  };
  for (let i = 0; i < 1000; i++)
    expect(createRocketTexture(scene as any, makeCanvas)).toBe(ROCKET_RENDER);
  expect(makeCanvas).toHaveBeenCalledTimes(1);
  expect(scene.textures.addCanvas).toHaveBeenCalledTimes(1);
  expect(canvas.width).toBe(52);
  expect(canvas.height).toBe(112);
  expect(ctx.drawImage).toHaveBeenCalledTimes(9);
  expect(ctx.globalCompositeOperation).toBe("source-over");
  expect(ctx.drawImage.mock.calls.at(-1)).toEqual([source, 4, 4, 44, 104]);
});
it("does not bake a missing source or pretend a missing canvas context is ready", () => {
  const makeCanvas = vi.fn(
    () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
  );
  const scene = { textures: { exists: () => false } };
  expect(createRocketTexture(scene as any, makeCanvas)).toBe(ROCKET_ART);
  expect(makeCanvas).not.toHaveBeenCalled();
  const loaded = {
    textures: { exists: (key: string) => key === ROCKET_ART.key },
  };
  expect(createRocketTexture(loaded as any, makeCanvas)).toBe(ROCKET_ART);
});

it("active missile art is the complete versioned vector with alpha margins", () => {
  const path = `public/assets/original/${ROCKET_ART.key}.svg`;
  const art = readFileSync(path, "utf8");
  expect(ROCKET_ART.key).toBe("hostile-missile-v3");
  expect(art).toContain('viewBox="0 0 11 26"');
  expect(art).not.toMatch(/<image|<script|<rect/);
});
