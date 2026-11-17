import { RAIDER_GEOMETRY } from "./raider-geometry";
import type Phaser from "phaser";
/** Original down-facing airframes: broad brake plates versus forward hooked wings. */
export const RAIDER_ART = {
  brakeRaider: {
    key: "enemy-brake",
    width: RAIDER_GEOMETRY.width,
    height: RAIDER_GEOMETRY.height,
  },
  hookWing: {
    key: "enemy-hook",
    width: RAIDER_GEOMETRY.width,
    height: RAIDER_GEOMETRY.height,
  },
} as const;
export function createRaiderTextures(scene: Phaser.Scene) {
  for (const [kind, spec] of Object.entries(RAIDER_ART)) {
    if (scene.textures.exists(spec.key)) continue;
    const texture = scene.textures.createCanvas(spec.key, 96, 84);
    if (!texture) continue;
    const c = texture.getContext();
    c.scale(2, 2);
    const poly = (points: number[][], color: string) => {
      c.fillStyle = color;
      c.beginPath();
      points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
    };
    // Offset dark silhouette and bevelled plates, never a neon outline badge.
    for (const side of [-1, 1]) {
      const points =
        kind === "brakeRaider"
          ? [
              [3, 9],
              [17, 13],
              [23, 29],
              [13, 34],
              [2, 25],
            ]
          : [
              [1, 4],
              [11, 9],
              [22, 25],
              [17, 32],
              [10, 23],
              [3, 30],
            ];
      const mirror = points.map(([x, y]) => [24 + side * (24 - x), y]);
      poly(
        mirror.map(([x, y]) => [x + 1, y + 2]),
        "#10202b",
      );
      poly(mirror, kind === "brakeRaider" ? "#9b7150" : "#537c7c");
      poly(
        [
          [24 + side * 8, 15],
          [24 + side * 20, 12],
          [24 + side * 16, 19],
          [24 + side * 9, 23],
        ],
        "#c0b298",
      );
      c.fillStyle = "#273640";
      c.fillRect(24 + side * 15 - 2, 17, 4, 9);
      c.fillStyle = "#de7450";
      c.fillRect(
        24 + side * RAIDER_GEOMETRY.gunX - 1,
        26,
        2,
        21 + RAIDER_GEOMETRY.gunY - 26,
      );
      c.fillStyle = "#93b9bb";
      c.fillRect(24 + side * 7 - 2, 6, 4, 7);
    }
    poly(
      [
        [20, 7],
        [28, 7],
        [32, 28],
        [24, 40],
        [16, 28],
      ],
      "#172a35",
    );
    poly(
      [
        [20, 7],
        [26, 7],
        [28, 29],
        [23, 36],
        [18, 27],
      ],
      "#89999a",
    );
    poly(
      [
        [21, 14],
        [26, 14],
        [27, 23],
        [20, 23],
      ],
      "#183c4a",
    );
    c.fillStyle = "#bce6da";
    c.fillRect(21, 15, 2, 5);
    c.fillStyle = "#b8503e";
    c.fillRect(20, 27, 8, 3);
    texture.refresh();
  }
}
