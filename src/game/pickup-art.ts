import type Phaser from "phaser";

export type PickupArtKind =
  | "heal"
  | "power"
  | "spread"
  | "beam"
  | "missile"
  | "support";
export interface PickupVisual {
  key: string;
  color: number;
  shortLabel: string;
  label: string;
}

/** Original geometry, not a recolor of a shared icon. Render at 32×32 logical px. */
export const PICKUP_VISUALS: Readonly<
  Record<PickupArtKind, Readonly<PickupVisual>>
> = {
  heal: { key: "pickup-heal", color: 0x81ffb0, shortLabel: "+", label: "修復" },
  power: {
    key: "pickup-power",
    color: 0xffd16c,
    shortLabel: "P",
    label: "火力升級",
  },
  spread: {
    key: "pickup-spread",
    color: 0xffac79,
    shortLabel: "S",
    label: "散射",
  },
  beam: { key: "pickup-beam", color: 0x83e5ff, shortLabel: "B", label: "光束" },
  missile: {
    key: "pickup-missile",
    color: 0xff94bf,
    shortLabel: "M",
    label: "追蹤飛彈",
  },
  support: {
    key: "pickup-support",
    color: 0xc8b0ff,
    shortLabel: "W",
    label: "僚機",
  },
};

export function pickupVisual(kind: string): Readonly<PickupVisual> {
  // Backward compatible names from earlier prototype builds.
  if (kind === "double") kind = "power";
  if (kind === "wingman") kind = "support";
  return PICKUP_VISUALS[kind as PickupArtKind] ?? PICKUP_VISUALS.power;
}

function polygon(context: CanvasRenderingContext2D, points: number[][]) {
  context.beginPath();
  points.forEach(([x, y], i) =>
    i === 0 ? context.moveTo(x, y) : context.lineTo(x, y),
  );
  context.closePath();
}

function paintPickup(context: CanvasRenderingContext2D, kind: PickupArtKind) {
  const hex = `#${PICKUP_VISUALS[kind].color.toString(16).padStart(6, "0")}`;
  context.clearRect(0, 0, 64, 64);
  const glow = context.createRadialGradient(32, 32, 10, 32, 32, 32);
  glow.addColorStop(0, `${hex}38`);
  glow.addColorStop(0.6, `${hex}20`);
  glow.addColorStop(1, `${hex}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = "rgba(5,18,29,0.88)";
  context.strokeStyle = hex;
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.lineCap = "round";
  const silhouettes: Record<PickupArtKind, number[][]> = {
    heal: [
      [17, 9],
      [47, 9],
      [55, 17],
      [55, 47],
      [47, 55],
      [17, 55],
      [9, 47],
      [9, 17],
    ],
    power: [
      [32, 7],
      [57, 32],
      [32, 57],
      [7, 32],
    ],
    spread: [
      [32, 7],
      [57, 24],
      [49, 53],
      [15, 53],
      [7, 24],
    ],
    beam: [
      [22, 7],
      [42, 7],
      [54, 20],
      [54, 44],
      [42, 57],
      [22, 57],
      [10, 44],
      [10, 20],
    ],
    missile: [
      [32, 6],
      [58, 52],
      [6, 52],
    ],
    support: [
      [5, 15],
      [25, 22],
      [32, 12],
      [39, 22],
      [59, 15],
      [54, 44],
      [32, 54],
      [10, 44],
    ],
  };
  polygon(context, silhouettes[kind]);
  context.fill();
  context.stroke();
  context.fillStyle = hex;
  context.strokeStyle = hex;
  context.lineWidth = 4;
  switch (kind) {
    case "heal":
      // Broad plus, recognisable without color or text.
      context.fillRect(27, 18, 10, 28);
      context.fillRect(18, 27, 28, 10);
      break;
    case "power":
      // Upward chevron and a small P: advance the weapon's power level.
      polygon(context, [
        [32, 16],
        [44, 29],
        [37, 29],
        [37, 38],
        [27, 38],
        [27, 29],
        [20, 29],
      ]);
      context.fill();
      context.font = "bold 13px sans-serif";
      context.textAlign = "center";
      context.fillText("P", 32, 50);
      break;
    case "spread":
      // Three fanning shots, visibly diverging from a shared emitter.
      context.beginPath();
      context.moveTo(32, 42);
      context.lineTo(18, 24);
      context.moveTo(32, 42);
      context.lineTo(32, 18);
      context.moveTo(32, 42);
      context.lineTo(46, 24);
      context.stroke();
      for (const [x, y] of [
        [18, 24],
        [32, 18],
        [46, 24],
      ]) {
        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);
        context.fill();
      }
      context.fillRect(26, 44, 12, 4);
      break;
    case "beam":
      // Twin uninterrupted rails, not a spread of bullets.
      context.fillRect(22, 17, 6, 30);
      context.fillRect(36, 17, 6, 30);
      context.fillStyle = "#efffff";
      context.fillRect(24, 18, 2, 28);
      context.fillRect(38, 18, 2, 28);
      context.strokeStyle = hex;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(19, 49);
      context.lineTo(45, 49);
      context.stroke();
      break;
    case "missile":
      // Guided arrowhead with fins and a curved tracking trail.
      polygon(context, [
        [33, 17],
        [39, 31],
        [36, 39],
        [40, 43],
        [32, 40],
        [25, 43],
        [29, 36],
        [27, 30],
      ]);
      context.fill();
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(29, 39);
      context.quadraticCurveTo(19, 38, 18, 47);
      context.stroke();
      break;
    case "support":
      // Two separate wingcraft flank the small central player.
      polygon(context, [
        [15, 24],
        [22, 40],
        [15, 37],
        [10, 40],
      ]);
      context.fill();
      polygon(context, [
        [49, 24],
        [54, 40],
        [49, 37],
        [42, 40],
      ]);
      context.fill();
      polygon(context, [
        [32, 24],
        [38, 43],
        [32, 39],
        [26, 43],
      ]);
      context.fill();
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(22, 44);
      context.lineTo(32, 48);
      context.lineTo(42, 44);
      context.stroke();
      break;
  }
}

/** Call once in Scene.create after texture manager is ready; safe on scene restart. */
export function createPickupTextures(scene: Phaser.Scene): void {
  for (const kind of Object.keys(PICKUP_VISUALS) as PickupArtKind[]) {
    const { key } = PICKUP_VISUALS[kind];
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, 64, 64);
    if (!texture) continue;
    paintPickup(texture.getContext(), kind);
    texture.refresh();
  }
}
