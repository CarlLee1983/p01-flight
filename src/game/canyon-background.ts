import type Phaser from "phaser";

/** Shared world-coordinate sampling keeps cliffs continuous across camera rows. */
export function canyonBanks(worldY: number) {
  const center = 180 + Math.sin(worldY / 470) * 13 + Math.sin(worldY / 191) * 5;
  const half = 91 + Math.sin(worldY / 680) * 6;
  return { left: center - half, right: center + half };
}
function stoneNoise(index: number, salt: number) {
  let value = Math.imul(index ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
type Point = { x: number; y: number };

/** Original canyon terrain. One normally batched Graphics object; no bitmap
 * copying, new external assets or global-single triangle rendering.
 * Roads, cliffs and current marks share stable world coordinates, not tiled
 * fillRects that form 80px stairs. Terrain is decorative, real ground targets
 * remain model enemies with their established 20px barrel anchors.
 */
export class CanyonBackground {
  private graphic: Phaser.GameObjects.Graphics;
  private time = 0;
  constructor(scene: Phaser.Scene) {
    this.graphic = scene.add.graphics().setDepth(-8);
  }
  update(time: number, visible: boolean) {
    this.time = time;
    const g = this.graphic;
    g.setVisible(visible);
    if (!visible) return;
    g.clear();
    const travel = time * 32;
    const path = (points: Point[], closed: boolean) => {
      g.beginPath();
      points.forEach((point, index) =>
        index === 0 ? g.moveTo(point.x, point.y) : g.lineTo(point.x, point.y),
      );
      if (closed) g.closePath();
    };
    const polygon = (points: Point[]) => {
      path(points, true);
      g.fillPath();
    };
    const stroke = (points: Point[]) => {
      path(points, false);
      g.strokePath();
    };
    g.fillStyle(0x9a6748);
    g.fillRect(0, 0, 360, 640);
    const rows: { y: number; world: number; left: number; right: number }[] =
      [];
    for (
      let world = Math.floor((travel - 680) / 24) * 24;
      world <= travel + 48;
      world += 24
    ) {
      rows.push({ y: travel - world, world, ...canyonBanks(world) });
    }
    const ribbon = (
      left: Point[],
      right: Point[],
      color: number,
      alpha = 1,
    ) => {
      g.fillStyle(color, alpha);
      polygon([...left, ...[...right].reverse()]);
    };
    // River bottom and narrow moving highlights stay lower contrast than bullets.
    ribbon(
      rows.map((r) => ({ x: r.left - 5, y: r.y })),
      rows.map((r) => ({ x: r.right + 5, y: r.y })),
      0x213f47,
    );
    ribbon(
      rows.map((r) => ({ x: r.left + 5, y: r.y })),
      rows.map((r) => ({ x: r.right - 5, y: r.y })),
      0x335e65,
    );
    ribbon(
      rows.map((r) => ({
        x: r.left + 26 + Math.sin(r.world / 90) * 4,
        y: r.y,
      })),
      rows.map((r) => ({
        x: r.right - 30 + Math.cos(r.world / 130) * 5,
        y: r.y,
      })),
      0x3c7276,
      0.64,
    );
    for (const side of [-1, 1]) {
      const bank = (r: (typeof rows)[number]) => (side < 0 ? r.left : r.right);
      // Nested terrace faces, a lit rim, then a dark water-side rock face.
      ribbon(
        rows.map((r) => ({ x: bank(r) - side * 27, y: r.y })),
        rows.map((r) => ({ x: bank(r) - side * 17, y: r.y })),
        0xc38c5e,
      );
      ribbon(
        rows.map((r) => ({ x: bank(r) - side * 17, y: r.y })),
        rows.map((r) => ({ x: bank(r) - side * 7, y: r.y })),
        0x82533f,
      );
      ribbon(
        rows.map((r) => ({ x: bank(r) - side * 7, y: r.y })),
        rows.map((r) => ({ x: bank(r) + side * 5, y: r.y })),
        0x4b3d35,
      );
      g.lineStyle(2, 0xd3a36e, 0.65);
      stroke(rows.map((r) => ({ x: bank(r) - side * 27, y: r.y })));
    }
    // Shoulder service roads match actual ground-unit x=50/310 placement.
    for (const x of [50, 310]) {
      g.fillStyle(0x564a3d);
      g.fillRect(x - 23, 0, 46, 640);
      g.fillStyle(0x827562);
      g.fillRect(x - 19, 0, 38, 640);
      g.lineStyle(1, 0xb29a77, 0.6);
      g.lineBetween(x - 18, 0, x - 18, 640);
      g.lineBetween(x + 18, 0, x + 18, 640);
    }
    for (
      let tile = Math.floor((travel - 680) / 46);
      tile <= Math.ceil((travel + 40) / 46);
      tile++
    ) {
      const y = travel - tile * 46;
      const banks = canyonBanks(tile * 46);
      // Original layered scree shapes and fissures, stable between frames.
      for (const side of [-1, 1]) {
        const x =
          side < 0
            ? 7 + stoneNoise(tile, 13) * 17
            : 336 + stoneNoise(tile, 31) * 17;
        const size = 4 + stoneNoise(tile, 7) * 10;
        g.fillStyle(0x5b4335, 0.8);
        polygon([
          { x: x - size, y: y + 2 },
          { x: x - size * 0.3, y: y - size * 0.6 },
          { x: x + size, y: y - 2 },
          { x: x + size * 0.6, y: y + size * 0.5 },
        ]);
        g.lineStyle(1, 0xd6a879, 0.65);
        g.lineBetween(x - size * 0.3, y - size * 0.6, x + size, y - 2);
        const bank = side < 0 ? banks.left : banks.right;
        g.lineStyle(1, 0x342c28, 0.7);
        g.lineBetween(bank - side * 20, y + 10, bank - side * 10, y + 17);
      }
      g.fillStyle(0xdbc08a, 0.65);
      g.fillRect(49, y + 6, 2, 13);
      g.fillRect(309, y + 26, 2, 13);
      const currentX = 130 + stoneNoise(tile, 49) * 88;
      g.lineStyle(1, 0x8eb3a4, 0.27);
      g.lineBetween(currentX, y + 12, currentX + 18, y + 10);
      g.lineBetween(currentX + 30, y + 28, currentX + 43, y + 26);
    }
    for (const [at, kind] of [
      [29, "bridge"],
      [58, "mine"],
      [123, "dam"],
    ] as const) {
      const y = travel - at * 32 + 100;
      if (y < -220 || y > 820) continue;
      if (kind === "bridge") {
        g.fillStyle(0x122e36, 0.65);
        g.fillRect(0, y + 16, 360, 72);
        g.fillStyle(0x77837d);
        g.fillRect(0, y, 360, 58);
        g.fillStyle(0x4f615e);
        for (let x = 0; x < 360; x += 30) g.fillRect(x, y + 8, 2, 43);
        g.lineStyle(4, 0x324346);
        g.lineBetween(0, y, 360, y);
        g.lineBetween(0, y + 59, 360, y + 59);
        g.lineStyle(2, 0xbeb78e);
        g.lineBetween(0, y + 5, 360, y + 5);
        g.lineBetween(0, y + 53, 360, y + 53);
        g.lineStyle(1, 0x374a4b);
        for (let x = 0; x < 360; x += 30) {
          g.lineBetween(x, y, x + 26, y + 7);
          g.lineBetween(x, y + 53, x + 26, y + 60);
        }
        g.fillStyle(0xe0c394, 0.8);
        for (let x = 10; x < 360; x += 20) g.fillRect(x, y + 28, 9, 2);
      } else if (kind === "mine") {
        for (const x of [3, 295]) {
          g.fillStyle(0x293c3e, 0.8);
          g.fillRect(x + 5, y + 7, 58, 116);
          g.fillStyle(0x5f6052);
          g.fillRoundedRect(x, y, 58, 100, 4);
          g.fillStyle(0xb29a71);
          polygon([
            { x, y: y + 7 },
            { x: x + 12, y: y - 7 },
            { x: x + 48, y: y - 7 },
            { x: x + 58, y: y + 7 },
          ]);
          g.fillStyle(0x817b61);
          g.fillRect(x + 5, y + 9, 48, 38);
          g.lineStyle(1, 0xc4b28a);
          for (let roof = 0; roof < 4; roof++)
            g.lineBetween(x + 8, y + 13 + roof * 8, x + 50, y + 13 + roof * 8);
          g.fillStyle(0x243a3d);
          g.fillRect(x + 13, y + 52, 32, 24);
          g.lineStyle(2, 0x3b403a);
          g.lineBetween(x + 16, y + 75, x + 16, y + 128);
          g.lineBetween(x + 42, y + 75, x + 42, y + 128);
          for (let i = 0; i < 6; i++)
            g.lineBetween(x + 12, y + 78 + i * 9, x + 46, y + 78 + i * 9);
          g.fillStyle(0xd4a767);
          g.fillRect(x + 4, y + 51, 3, 8);
          g.fillRect(x + 51, y + 51, 3, 8);
        }
      } else {
        g.fillStyle(0x102e38, 0.72);
        g.fillRect(0, y + 18, 360, 140);
        g.fillStyle(0x7c877c);
        g.fillRect(0, y, 360, 91);
        for (let x = 79; x < 290; x += 30) {
          g.fillStyle(0x344f53);
          g.fillRect(x, y + 25, 18, 67);
          g.fillStyle(0x78a6a0, 0.8);
          g.fillRect(x + 5, y + 52, 8, 82);
          g.fillStyle(0xadb39b);
          g.fillRect(x - 5, y + 17, 4, 76);
          g.lineStyle(1, 0xc1ddd1, 0.3);
          g.lineBetween(x + 9, y + 82, x + 9, y + 130);
        }
        g.fillStyle(0xc7b58d);
        g.fillRect(0, y + 6, 360, 8);
        g.lineStyle(2, 0x4c5b55);
        g.lineBetween(0, y, 360, y);
        g.lineBetween(0, y + 96, 360, y + 96);
      }
    }
  }
  diagnostics() {
    return {
      theme: "canyon",
      time: this.time,
      worldDistance: this.time * 32,
      landmarks: ["bridge", "mine", "dam"],
      terrain: "continuous-world-banks",
    };
  }
}
