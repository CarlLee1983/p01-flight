import { expect, it } from "vitest";
import {
  BOSS_SUPPORT_ART,
  ENEMY_MODULE_ART,
  createEnemyModuleTextures,
  enemyModuleVisual,
} from "../src/game/enemy-modules-art";

it("complete airframes preserve established display dimensions and muzzle coordinates", () => {
  expect(enemyModuleVisual("escort")).toMatchObject({
    width: 70,
    height: 44,
    muzzles: [{ x: 0, y: 20 }],
  });
  expect(enemyModuleVisual("gatekeeper")).toMatchObject({
    width: 104,
    height: 76,
    muzzles: [
      { x: -39, y: 32 },
      { x: 39, y: 32 },
    ],
  });
  expect(enemyModuleVisual("turret")).toMatchObject({
    width: 56,
    height: 49,
    muzzles: [{ x: 0, y: 17 }],
  });
  expect(BOSS_SUPPORT_ART).toEqual({
    key: "boss-support",
    width: 184,
    height: 100,
  });
});
it("creates four bounded original textures once, with actual barrel mouths at declared ends", () => {
  type Mark = { color: string; points: number[][]; rect?: number[] };
  const painted = new Map<string, { w: number; h: number; marks: Mark[] }>();
  let refreshed = 0;
  const scene: any = {
    textures: {
      exists: (key: string) => painted.has(key),
      createCanvas(key: string, w: number, h: number) {
        const entry = { w, h, marks: [] as Mark[] };
        painted.set(key, entry);
        let path: number[][] = [];
        const c: any = {
          fillStyle: "",
          strokeStyle: "",
          clearRect() {},
          beginPath() {
            path = [];
          },
          moveTo(x: number, y: number) {
            path.push([x, y]);
          },
          lineTo(x: number, y: number) {
            path.push([x, y]);
          },
          closePath() {},
          fill() {
            entry.marks.push({
              color: this.fillStyle,
              points: path.map((p) => [...p]),
            });
          },
          stroke() {
            entry.marks.push({
              color: this.strokeStyle,
              points: path.map((p) => [...p]),
            });
          },
          fillRect(x: number, y: number, width: number, height: number) {
            entry.marks.push({
              color: this.fillStyle,
              points: [
                [x, y],
                [x + width, y + height],
              ],
              rect: [x, y, width, height],
            });
          },
        };
        return {
          getContext: () => c,
          refresh() {
            refreshed++;
          },
        };
      },
    },
  };
  createEnemyModuleTextures(scene);
  createEnemyModuleTextures(scene);
  expect(painted.size).toBe(4);
  expect(refreshed).toBe(4);
  for (const entry of painted.values()) {
    expect(entry.marks.length).toBeLessThan(100);
    for (const mark of entry.marks)
      for (const [x, y] of mark.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(entry.w);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(entry.h);
      }
  }
  for (const spec of Object.values(ENEMY_MODULE_ART)) {
    const entry = painted.get(spec.key)!;
    expect([entry.w, entry.h]).toEqual([spec.width * 2, spec.height * 2]);
    expect(
      new Set(entry.marks.map((m) => m.color)).size,
    ).toBeGreaterThanOrEqual(8);
    // Each hull has separate lit bevel, shadow side wall and recessed cockpit planes.
    const colors = new Set(entry.marks.map((m) => m.color));
    for (const material of [
      "#c4926d",
      "#a87758",
      "#513a32",
      "#314852",
      "#4a777d",
    ])
      expect(colors.has(material)).toBe(true);
    for (const muzzle of spec.muzzles) {
      const x = (spec.width / 2 + muzzle.x) * 2,
        y = (spec.height / 2 + muzzle.y) * 2;
      expect(
        entry.marks.some(
          (m) =>
            m.color === "#101f29" &&
            m.rect &&
            m.rect[0] + m.rect[2] / 2 === x &&
            m.rect[1] + m.rect[3] === y,
        ),
      ).toBe(true);
    }
  }
  // Escort's three nose ports belong to one unchanged central fan origin;
  // side nacelles are intake slats, not a second pair of weapon mouths.
  const escort = painted.get("enemy-escort")!;
  const nosePorts = escort.marks.filter(
    (m) => m.color === "#101f29" && m.rect && m.rect[1] + m.rect[3] === 84,
  );
  expect(nosePorts.map((m) => m.rect![0] + m.rect![2] / 2)).toEqual([
    64, 70, 76,
  ]);
  expect(nosePorts.every((m) => m.rect![2] === 4 && m.rect![3] === 4)).toBe(
    true,
  );
  // Each shoulder mark lives wholly left or right of the hull, with no opaque centre patch.
  const shoulder = painted.get("boss-support")!;
  expect([shoulder.w, shoulder.h]).toEqual([368, 200]);
  for (const mark of shoulder.marks) {
    const xs = mark.points.map((p) => p[0]);
    expect(Math.max(...xs) < 184 || Math.min(...xs) > 184).toBe(true);
  }
});
it("failed CanvasTexture allocation does not crash startup", () => {
  const scene: any = {
    textures: { exists: () => false, createCanvas: () => null },
  };
  expect(() => createEnemyModuleTextures(scene)).not.toThrow();
});
