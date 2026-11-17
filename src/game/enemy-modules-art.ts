import type Phaser from "phaser";
export type EnemyModuleKind = "escort" | "gatekeeper" | "turret";
/** Display dimensions and local muzzle ends share the established combat geometry. */
export const ENEMY_MODULE_ART = {
  escort: {
    key: "enemy-escort",
    width: 70,
    height: 44,
    muzzles: [{ x: 0, y: 20 }],
  },
  gatekeeper: {
    key: "enemy-patrol",
    width: 104,
    height: 76,
    muzzles: [
      { x: -39, y: 32 },
      { x: 39, y: 32 },
    ],
  },
  turret: {
    key: "enemy-gunship",
    width: 56,
    height: 49,
    muzzles: [{ x: 0, y: 17 }],
  },
} as const;
export function enemyModuleVisual(kind: EnemyModuleKind) {
  return ENEMY_MODULE_ART[kind];
}
const METAL = {
  dark: "#101f29",
  shadow: "#253641",
  steel: "#536870",
  light: "#b6b7a5",
  copper: "#a16b50",
  copperLight: "#cf9970",
  gold: "#e0b577",
  red: "#8c493e",
  glass: "#88b8b8",
} as const;

/** Original complete hulls, not frames layered behind unrelated ship images.
 * Coordinates are logical pixels around the exact centre; texture is 2× resolution. */
export function paintEnemyModule(
  c: CanvasRenderingContext2D,
  kind: EnemyModuleKind,
): void {
  const spec = ENEMY_MODULE_ART[kind];
  const ox = spec.width / 2,
    oy = spec.height / 2;
  c.clearRect(0, 0, spec.width * 2, spec.height * 2);
  c.lineJoin = "round";
  c.lineCap = "round";
  const poly = (points: number[][], color: string) => {
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) =>
      i
        ? c.lineTo((x + ox) * 2, (y + oy) * 2)
        : c.moveTo((x + ox) * 2, (y + oy) * 2),
    );
    c.closePath();
    c.fill();
  };
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect((x + ox) * 2, (y + oy) * 2, w * 2, h * 2);
  };
  const line = (points: number[][], color: string, width = 1) => {
    c.strokeStyle = color;
    c.lineWidth = width * 2;
    c.beginPath();
    points.forEach(([x, y], i) =>
      i
        ? c.lineTo((x + ox) * 2, (y + oy) * 2)
        : c.moveTo((x + ox) * 2, (y + oy) * 2),
    );
    c.stroke();
  };
  const mirror = (points: number[][], side: number) =>
    points.map(([x, y]) => [x * side, y]);
  const gun = (x: number, y: number, length: number, width: number) => {
    // Barrel termination, not a detached square: the black mouth ends exactly at y.
    rect(x - width / 2 - 1, y - length - 1, width + 2, length + 1, METAL.dark);
    rect(x - width / 2, y - length, width, length - 1, METAL.steel);
    rect(
      x - width / 2,
      y - length,
      Math.max(1, width / 3),
      length - 2,
      METAL.light,
    );
    rect(x - width / 2 - 1, y - 5, width + 2, 2, METAL.copper);
    rect(x - width / 2, y - 2, width, 2, METAL.dark);
    line(
      [
        [x - width / 2, y - 2],
        [x + width / 2, y - 2],
      ],
      METAL.gold,
    );
  };
  const vent = (x: number, y: number, w: number) => {
    rect(x, y, w, 6, METAL.dark);
    for (let row = 1; row < 6; row += 2)
      rect(x + 1, y + row, w - 2, 1, METAL.steel);
  };
  if (kind === "escort") {
    // Broad swept wing spar joins armoured intakes; the central fan launcher preserves combat origin.
    poly(
      [
        [-9, -19],
        [9, -19],
        [14, -9],
        [31, -13],
        [34, 0],
        [29, 12],
        [17, 15],
        [8, 9],
        [0, 20],
        [-8, 9],
        [-17, 15],
        [-29, 12],
        [-34, 0],
        [-31, -13],
        [-14, -9],
      ],
      METAL.dark,
    );
    for (const side of [-1, 1]) {
      poly(
        mirror(
          [
            [9, -10],
            [29, -11],
            [31, -1],
            [26, 10],
            [17, 12],
            [8, 5],
          ],
          side,
        ),
        METAL.copper,
      );
      poly(
        mirror(
          [
            [10, -8],
            [28, -9],
            [29, -5],
            [15, -3],
            [10, 3],
          ],
          side,
        ),
        METAL.copperLight,
      );
      poly(
        mirror(
          [
            [28, -4],
            [29, 1],
            [25, 10],
            [17, 12],
            [16, 7],
          ],
          side,
        ),
        METAL.red,
      );
      poly(
        mirror(
          [
            [13, -14],
            [20, -17],
            [24, -13],
            [22, 0],
            [14, 3],
          ],
          side,
        ),
        METAL.steel,
      );
      vent(side * 18 - 3, -12, 6);
      // Recessed, transverse intake slats, not forward-facing weapon barrels.
      vent(side * 23 - 4, 3, 8);
      rect(side * 12 - 2, -17, 4, 5, METAL.shadow);
      rect(side * 12 - 1, -18, 2, 2, METAL.gold);
    }
    poly(
      [
        [-6, -17],
        [6, -17],
        [9, 6],
        [0, 19],
        [-9, 6],
      ],
      METAL.steel,
    );
    poly(
      [
        [-5, -16],
        [0, -17],
        [1, 12],
        [-1, 15],
        [-6, 4],
      ],
      METAL.light,
    );
    poly(
      [
        [-4, -8],
        [4, -8],
        [5, 1],
        [0, 6],
        [-5, 1],
      ],
      METAL.dark,
    );
    poly(
      [
        [-2, -7],
        [2, -7],
        [3, 0],
        [0, 3],
        [-3, 0],
      ],
      METAL.glass,
    );
    rect(-4, 8, 8, 3, METAL.red);
    // Short three-port nose launcher. Centre port terminates at the unchanged fan origin.
    poly(
      [
        [-5, 10],
        [5, 10],
        [7, 17],
        [5, 20],
        [-5, 20],
        [-7, 17],
      ],
      METAL.dark,
    );
    poly(
      [
        [-4, 11],
        [4, 11],
        [5, 16],
        [-5, 16],
      ],
      METAL.copper,
    );
    rect(-4, 12, 8, 2, METAL.copperLight);
    rect(-5, 16, 10, 2, METAL.gold);
    for (const x of [-3, 0, 3]) rect(x - 1, 18, 2, 2, METAL.dark);
  } else if (kind === "gatekeeper") {
    // Heavy patrol hull: layered shoulders, long integral sponsons and a protected bridge.
    poly(
      [
        [-12, -35],
        [12, -35],
        [22, -24],
        [42, -25],
        [49, -14],
        [48, 19],
        [44, 34],
        [33, 34],
        [29, 19],
        [15, 22],
        [7, 33],
        [-7, 33],
        [-15, 22],
        [-29, 19],
        [-33, 34],
        [-44, 34],
        [-48, 19],
        [-49, -14],
        [-42, -25],
        [-22, -24],
      ],
      METAL.dark,
    );
    for (const side of [-1, 1]) {
      poly(
        mirror(
          [
            [17, -22],
            [40, -23],
            [46, -13],
            [44, 17],
            [31, 19],
            [24, 9],
            [14, 12],
          ],
          side,
        ),
        METAL.copper,
      );
      poly(
        mirror(
          [
            [19, -21],
            [39, -21],
            [43, -16],
            [24, -15],
            [18, -8],
          ],
          side,
        ),
        METAL.copperLight,
      );
      poly(
        mirror(
          [
            [43, -13],
            [44, 12],
            [39, 20],
            [32, 16],
            [34, -10],
          ],
          side,
        ),
        METAL.red,
      );
      poly(
        mirror(
          [
            [15, -14],
            [29, -13],
            [31, 10],
            [24, 16],
            [14, 10],
          ],
          side,
        ),
        METAL.steel,
      );
      line(
        mirror(
          [
            [17, -12],
            [27, -11],
            [28, 7],
          ],
          side,
        ),
        METAL.light,
        2,
      );
      vent(side * 23 - 4, -5, 8);
      // Sponson collars and the shared wing structure are one continuous silhouette.
      poly(
        mirror(
          [
            [34, 4],
            [44, 4],
            [45, 22],
            [42, 28],
            [35, 28],
            [32, 21],
          ],
          side,
        ),
        METAL.steel,
      );
      gun(side * 39, 32, 21, 5);
      rect(side * 31 - 3, -24, 6, 9, METAL.shadow);
      rect(side * 31 - 2, -25, 4, 3, METAL.gold);
      rect(side * 17 - 2, 14, 4, 4, METAL.gold);
    }
    poly(
      [
        [-9, -33],
        [9, -33],
        [16, -16],
        [13, 17],
        [6, 29],
        [-6, 29],
        [-13, 17],
        [-16, -16],
      ],
      METAL.steel,
    );
    poly(
      [
        [-8, -30],
        [-1, -32],
        [1, 23],
        [-4, 24],
        [-10, 13],
        [-13, -15],
      ],
      METAL.light,
    );
    poly(
      [
        [-7, -19],
        [7, -19],
        [10, -6],
        [5, 2],
        [-5, 2],
        [-10, -6],
      ],
      METAL.dark,
    );
    poly(
      [
        [-5, -17],
        [5, -17],
        [7, -7],
        [3, -3],
        [-3, -3],
        [-7, -7],
      ],
      METAL.glass,
    );
    rect(-7, 5, 14, 5, METAL.red);
    rect(-4, 13, 8, 5, METAL.gold);
    line(
      [
        [-6, 23],
        [6, 23],
      ],
      METAL.copperLight,
      2,
    );
  } else {
    // Compact gunboat: blunt shoulders, paired turbines and one long central nose gun.
    poly(
      [
        [-8, -22],
        [8, -22],
        [12, -15],
        [23, -12],
        [26, -1],
        [20, 12],
        [9, 15],
        [5, 19],
        [-5, 19],
        [-9, 15],
        [-20, 12],
        [-26, -1],
        [-23, -12],
        [-12, -15],
      ],
      METAL.dark,
    );
    for (const side of [-1, 1]) {
      poly(
        mirror(
          [
            [9, -13],
            [21, -10],
            [23, -1],
            [18, 9],
            [8, 11],
            [7, 1],
          ],
          side,
        ),
        METAL.copper,
      );
      poly(
        mirror(
          [
            [10, -11],
            [20, -8],
            [21, -4],
            [11, -5],
          ],
          side,
        ),
        METAL.copperLight,
      );
      poly(
        mirror(
          [
            [21, -2],
            [17, 9],
            [9, 11],
            [9, 6],
          ],
          side,
        ),
        METAL.red,
      );
      poly(
        mirror(
          [
            [7, -20],
            [14, -17],
            [16, -5],
            [11, 1],
            [6, -3],
          ],
          side,
        ),
        METAL.steel,
      );
      vent(side * 11 - 3, -14, 6);
      rect(side * 10 - 2, -21, 4, 3, METAL.gold);
      line(
        mirror(
          [
            [18, 1],
            [15, 6],
            [11, 7],
          ],
          side,
        ),
        METAL.light,
        2,
      );
    }
    poly(
      [
        [-5, -20],
        [5, -20],
        [8, -4],
        [5, 10],
        [-5, 10],
        [-8, -4],
      ],
      METAL.steel,
    );
    poly(
      [
        [-3, -17],
        [3, -17],
        [4, -8],
        [0, -4],
        [-4, -8],
      ],
      METAL.dark,
    );
    poly(
      [
        [-2, -15],
        [2, -15],
        [2, -9],
        [0, -7],
        [-2, -9],
      ],
      METAL.glass,
    );
    gun(0, 17, 14, 6);
    rect(-5, -2, 10, 4, METAL.copperLight);
  }
  // Broad raised armour faces, lit from upper-left. These are structural planes,
  // not noise/scratches: the right wall stays darker on BOTH mirrored wings.
  // Keep the original silhouette, all weapon mouths and combat geometry untouched.
  if (kind === "escort") {
    for (const side of [-1, 1]) {
      poly(
        mirror(
          [
            [19, -8],
            [27, -7],
            [28, -2],
            [24, 2],
            [19, 1],
          ],
          side,
        ),
        "#835641",
      );
      poly(
        mirror(
          [
            [19, -8],
            [27, -7],
            [26, -5],
            [20, -5],
          ],
          side,
        ),
        side < 0 ? "#c4926d" : "#a87758",
      );
      poly(
        mirror(
          [
            [26, -5],
            [28, -2],
            [24, 2],
            [23, 0],
          ],
          side,
        ),
        "#513a32",
      );
    }
    poly(
      [
        [3, -15],
        [6, -15],
        [8, 5],
        [4, 11],
        [2, 6],
      ],
      "#314852",
    );
    poly(
      [
        [-5, -15],
        [-3, -16],
        [-3, -10],
        [-5, -9],
      ],
      "#c2c3ad",
    );
    poly(
      [
        [-2, -6],
        [2, -6],
        [2, -3],
        [-1, -1],
      ],
      "#4a777d",
    );
    poly(
      [
        [-2, -6],
        [1, -6],
        [0, -5],
        [-2, -4],
      ],
      "#c0d2c7",
    );
  } else if (kind === "gatekeeper") {
    for (const side of [-1, 1]) {
      poly(
        mirror(
          [
            [32, -14],
            [41, -14],
            [42, -8],
            [40, 0],
            [33, 1],
          ],
          side,
        ),
        "#86563e",
      );
      poly(
        mirror(
          [
            [32, -14],
            [41, -14],
            [40, -11],
            [33, -10],
          ],
          side,
        ),
        side < 0 ? "#c4926d" : "#a87758",
      );
      poly(
        mirror(
          [
            [40, -11],
            [42, -8],
            [40, 0],
            [37, 0],
            [39, -7],
          ],
          side,
        ),
        "#513a32",
      );
      // Lower shoulder bevel is below the raised plate, before the gun sponson.
      poly(
        mirror(
          [
            [16, 10],
            [23, 13],
            [29, 9],
            [28, 14],
            [24, 17],
            [16, 14],
          ],
          side,
        ),
        "#293c46",
      );
    }
    poly(
      [
        [8, -28],
        [12, -18],
        [10, 13],
        [5, 24],
        [3, 22],
        [7, 10],
      ],
      "#314852",
    );
    poly(
      [
        [-8, -28],
        [-5, -30],
        [-4, -22],
        [-9, -19],
      ],
      "#c2c3ad",
    );
    // Recessed cockpit: darker lower glass and one restrained reflected sky plane.
    poly(
      [
        [-5, -15],
        [4, -15],
        [6, -8],
        [2, -4],
        [-3, -4],
      ],
      "#4a777d",
    );
    poly(
      [
        [-4, -16],
        [3, -16],
        [4, -13],
        [-4, -11],
      ],
      "#b5c9be",
    );
    poly(
      [
        [-6, 6],
        [6, 6],
        [4, 8],
        [-5, 8],
      ],
      "#ae7351",
    );
  } else {
    for (const side of [-1, 1]) {
      poly(
        mirror(
          [
            [16, -6],
            [21, -3],
            [18, 4],
            [14, 6],
            [14, 2],
          ],
          side,
        ),
        "#835641",
      );
      poly(
        mirror(
          [
            [16, -6],
            [21, -3],
            [19, -2],
            [16, -3],
          ],
          side,
        ),
        side < 0 ? "#c4926d" : "#a87758",
      );
      poly(
        mirror(
          [
            [19, -2],
            [18, 4],
            [14, 6],
            [14, 4],
          ],
          side,
        ),
        "#513a32",
      );
    }
    poly(
      [
        [4, -19],
        [6, -10],
        [7, -4],
        [5, -3],
        [3, -8],
      ],
      "#314852",
    );
    poly(
      [
        [-5, -19],
        [-3, -19],
        [-4, -10],
        [-6, -8],
      ],
      "#a9b1a2",
    );
    poly(
      [
        [-1, -14],
        [1, -14],
        [1, -10],
        [0, -8],
        [-1, -10],
      ],
      "#4a777d",
    );
  }
}
export function createEnemyModuleTextures(scene: Phaser.Scene): void {
  for (const kind of Object.keys(ENEMY_MODULE_ART) as EnemyModuleKind[]) {
    const spec = ENEMY_MODULE_ART[kind];
    if (scene.textures.exists(spec.key)) continue;
    const texture = scene.textures.createCanvas(
      spec.key,
      spec.width * 2,
      spec.height * 2,
    );
    if (!texture) continue;
    paintEnemyModule(texture.getContext(), kind);
    texture.refresh();
  }
  if (!scene.textures.exists(BOSS_SUPPORT_ART.key)) {
    const texture = scene.textures.createCanvas(BOSS_SUPPORT_ART.key, 368, 200);
    if (texture) {
      paintBossSupport(texture.getContext());
      texture.refresh();
    }
  }
}

export const BOSS_SUPPORT_ART = {
  key: "boss-support",
  width: 184,
  height: 100,
} as const;
/** Empty central area: this texture joins existing hull and cannon sprites behind them. */
export function paintBossSupport(c: CanvasRenderingContext2D): void {
  c.clearRect(0, 0, 368, 200);
  const poly = (points: number[][], color: string) => {
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) =>
      i
        ? c.lineTo((x + 92) * 2, (y + 50) * 2)
        : c.moveTo((x + 92) * 2, (y + 50) * 2),
    );
    c.closePath();
    c.fill();
  };
  for (const side of [-1, 1]) {
    const mirror = (points: number[][]) =>
      points.map(([x, y]) => [x * side, y]);
    poly(
      mirror([
        [31, -1],
        [46, -2],
        [59, 7],
        [76, 10],
        [81, 20],
        [75, 29],
        [62, 29],
        [48, 19],
        [34, 15],
      ]),
      METAL.dark,
    );
    poly(
      mirror([
        [33, 0],
        [45, 0],
        [59, 9],
        [75, 12],
        [78, 20],
        [72, 26],
        [63, 25],
        [49, 17],
        [35, 13],
      ]),
      METAL.steel,
    );
    poly(
      mirror([
        [33, 0],
        [45, 0],
        [59, 9],
        [75, 12],
        [76, 15],
        [58, 13],
        [44, 4],
        [34, 4],
      ]),
      METAL.light,
    );
    poly(
      mirror([
        [45, 6],
        [57, 14],
        [68, 15],
        [72, 21],
        [65, 23],
        [54, 18],
        [43, 11],
      ]),
      METAL.copper,
    );
    poly(
      mirror([
        [47, 15],
        [61, 25],
        [72, 26],
        [77, 20],
        [72, 23],
        [62, 22],
        [49, 13],
      ]),
      METAL.shadow,
    );
    for (const [x, y] of [
      [39, 7],
      [62, 17],
      [73, 18],
    ]) {
      c.fillStyle = METAL.dark;
      c.fillRect((x * side + 92 - 2) * 2, (y + 50 - 2) * 2, 8, 8);
      c.fillStyle = METAL.gold;
      c.fillRect((x * side + 92 - 1) * 2, (y + 50 - 1) * 2, 4, 4);
    }
  }
}
