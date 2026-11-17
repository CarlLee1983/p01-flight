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

/** Original mechanical supply sprites. Render at 32×32 logical px. */
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

/** Material facets stay broad at the actual 32px display size. No glow badge. */
function paintPickup(context: CanvasRenderingContext2D, kind: PickupArtKind) {
  context.clearRect(0, 0, 64, 64);
  context.lineJoin = "round";
  context.lineCap = "round";
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  };
  const shape = (points: number[][], color: string, edge = "#14232b") => {
    polygon(context, points);
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 2;
    context.stroke();
  };
  const seam = (points: number[][], color = "#c5c5af", width = 2) => {
    context.beginPath();
    points.forEach(([x, y], i) =>
      i === 0 ? context.moveTo(x, y) : context.lineTo(x, y),
    );
    context.strokeStyle = color;
    context.lineWidth = width;
    context.stroke();
  };
  const plate = (points: number[][], color: string) => {
    polygon(
      context,
      points.map(([x, y]) => [x + 2, y + 3]),
    );
    context.fillStyle = "#07151dd9";
    context.fill();
    shape(points, color);
    seam(points.slice(0, 3), "#c3bda6");
  };
  const collar = (x: number, y: number, w: number) => {
    rect(x, y, w, 5, "#263841");
    rect(x + 1, y, w - 2, 2, "#a9ada6");
  };
  switch (kind) {
    case "heal":
      // A latched field-repair case: handle, broad ceramic lid, dark depth and a large plus.
      plate(
        [
          [9, 20],
          [15, 14],
          [49, 14],
          [55, 20],
          [55, 50],
          [49, 55],
          [15, 55],
          [9, 49],
        ],
        "#526e6a",
      );
      shape(
        [
          [23, 14],
          [23, 8],
          [41, 8],
          [41, 14],
        ],
        "#9ba89a",
      );
      rect(28, 10, 8, 4, "#172e37");
      rect(15, 20, 34, 28, "#cbcbb8");
      rect(17, 22, 30, 3, "#eeeed9");
      rect(28, 25, 8, 20, "#347b62");
      rect(22, 31, 20, 8, "#347b62");
      for (const x of [11, 48]) {
        rect(x, 25, 5, 9, "#2c4146");
        rect(x, 25, 5, 3, "#d9b675");
      }
      rect(19, 49, 26, 4, "#2c4246");
      break;
    case "power":
      // A three-cell power pack with exposed gold cells and a top connector, not an arrow badge.
      plate(
        [
          [12, 17],
          [18, 11],
          [46, 11],
          [52, 17],
          [52, 52],
          [46, 57],
          [18, 57],
          [12, 52],
        ],
        "#4b5558",
      );
      for (const x of [21, 35]) {
        rect(x, 5, 8, 8, "#aba892");
        rect(x, 5, 8, 3, "#ede1b5");
      }
      rect(16, 18, 32, 29, "#1b3039");
      for (const x of [18, 28, 38]) {
        rect(x, 20, 8, 25, "#b88940");
        rect(x + 1, 21, 3, 22, "#f4cf79");
        rect(x, 19, 8, 4, "#d7d4ab");
        rect(x, 42, 8, 4, "#735531");
      }
      collar(14, 28, 36);
      rect(22, 49, 20, 5, "#dfb45c");
      break;
    case "spread":
      // Complete multi-barrel gun pod. Three long barrels make the weapon readable in silhouette.
      plate(
        [
          [13, 34],
          [20, 28],
          [44, 28],
          [51, 34],
          [49, 53],
          [42, 58],
          [22, 58],
          [15, 53],
        ],
        "#746b58",
      );
      for (const [x, y] of [
        [13, 12],
        [27, 5],
        [41, 12],
      ]) {
        shape(
          [
            [x, y],
            [x + 10, y],
            [x + 10, 38],
            [x, 38],
          ],
          "#546772",
        );
        rect(x + 2, y + 3, 3, 29, "#abb9b6");
        collar(x - 1, y, 12);
        rect(x + 2, y + 1, 6, 2, "#111e27");
        collar(x - 1, 26, 12);
      }
      shape(
        [
          [20, 38],
          [44, 38],
          [44, 50],
          [38, 55],
          [26, 55],
          [20, 50],
        ],
        "#9a7b55",
      );
      rect(25, 42, 14, 6, "#edbd71");
      rect(29, 50, 6, 5, "#253945");
      break;
    case "beam":
      // Twin conductive rails around a broad core, with a heavy rear power coupler.
      plate(
        [
          [10, 42],
          [17, 35],
          [47, 35],
          [54, 42],
          [49, 56],
          [15, 56],
        ],
        "#485e6a",
      );
      for (const x of [14, 40]) {
        shape(
          [
            [x, 7],
            [x + 10, 7],
            [x + 10, 44],
            [x, 44],
          ],
          "#7f969b",
        );
        rect(x + 2, 10, 3, 30, "#d0d4c5");
        rect(x + 7, 13, 3, 27, "#335466");
        collar(x - 2, 7, 14);
        collar(x - 2, 39, 14);
      }
      rect(27, 16, 10, 29, "#244858");
      rect(29, 17, 6, 27, "#8bd3d4");
      rect(30, 19, 3, 22, "#def5e4");
      shape(
        [
          [20, 45],
          [44, 45],
          [40, 55],
          [24, 55],
        ],
        "#8fa6a0",
      );
      rect(26, 48, 12, 4, "#2a4654");
      break;
    case "missile":
      // Three real missiles in a launch rack: nose cones, bodies, fins and retaining band.
      plate(
        [
          [9, 34],
          [55, 34],
          [53, 54],
          [11, 54],
        ],
        "#535e56",
      );
      for (const [x, y] of [
        [11, 17],
        [27, 7],
        [43, 17],
      ]) {
        shape(
          [
            [x, y + 12],
            [x + 5, y],
            [x + 10, y + 12],
            [x + 10, 46],
            [x, 46],
          ],
          "#b8b8a2",
        );
        shape(
          [
            [x, y + 12],
            [x + 5, y],
            [x + 10, y + 12],
          ],
          "#b3654c",
        );
        rect(x + 2, y + 15, 3, 24 - y, "#e6dfbf");
        shape(
          [
            [x, 36],
            [x - 4, 47],
            [x + 3, 44],
            [x + 7, 44],
            [x + 14, 47],
            [x + 10, 36],
          ],
          "#6f807a",
        );
        rect(x + 2, 45, 6, 7, "#263a44");
      }
      collar(9, 31, 46);
      rect(26, 51, 12, 5, "#d7b170");
      break;
    case "support":
      // Two deployable wingcraft on a short docking rack, not a formation pictogram.
      rect(10, 39, 44, 10, "#142932");
      rect(13, 41, 38, 4, "#8c9a91");
      for (const x of [19, 45]) {
        plate(
          [
            [x, 9],
            [x + 5, 22],
            [x + 12, 33],
            [x + 12, 42],
            [x + 5, 38],
            [x + 4, 52],
            [x - 4, 52],
            [x - 5, 38],
            [x - 12, 42],
            [x - 12, 33],
            [x - 5, 22],
          ],
          "#7b9ca4",
        );
        shape(
          [
            [x, 13],
            [x + 3, 27],
            [x + 2, 41],
            [x - 2, 41],
            [x - 3, 27],
          ],
          "#d6d9c6",
        );
        rect(x - 2, 26, 4, 9, "#244959");
        rect(x - 3, 45, 6, 8, "#283e4b");
        rect(x - 2, 49, 4, 3, "#e6b36b");
      }
      break;
  }
  // Physical identification paint, not a surrounding glowing UI badge.
  // Shape remains the primary cue; the separately rendered text label adds a non-colour cue.
  const accent = `#${PICKUP_VISUALS[kind].color.toString(16).padStart(6, "0")}`;
  switch (kind) {
    case "heal":
      rect(19, 48, 26, 4, accent);
      rect(28, 48, 8, 2, "#f4f2df");
      break;
    case "power":
      rect(16, 29, 32, 4, accent);
      for (const x of [20, 30, 40]) rect(x, 29, 3, 4, "#172d37");
      break;
    case "spread":
      rect(23, 42, 18, 7, accent);
      for (const x of [26, 31, 36]) rect(x, 43, 2, 5, "#263641");
      break;
    case "beam":
      for (const x of [21, 40]) rect(x, 15, 3, 22, accent);
      rect(29, 48, 6, 3, "#eaf5e8");
      break;
    case "missile":
      for (const x of [11, 27, 43]) {
        rect(x + 1, 27, 8, 4, accent);
        rect(x + 1, 27, 8, 1, "#fff0df");
      }
      break;
    case "support":
      for (const x of [19, 45]) {
        rect(x - 3, 25, 6, 11, accent);
        rect(x - 2, 25, 4, 3, "#edf1ef");
      }
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
