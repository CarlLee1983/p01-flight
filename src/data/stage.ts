export type Behavior =
  | "straight"
  | "weave"
  | "turret"
  | "heavy"
  | "dive"
  | "cross"
  | "carrier";
export type PickupKind =
  | "heal"
  | "double"
  | "power"
  | "spread"
  | "beam"
  | "missile"
  | "support";
export interface Wave {
  at: number;
  x: number;
  speed: number;
  hp: number;
  points: number;
  behavior?: Behavior;
  fireEvery?: number;
  drop?: PickupKind;
  spawnY?: number;
  direction?: number;
}
export interface StageConfig {
  id: string;
  title: string;
  duration: number;
  width: number;
  height: number;
  waves: Wave[];
  pickups?: { at: number; x: number; kind: PickupKind }[];
  boss?: {
    at: number;
    hp: number;
    fireEvery: number;
    bulletSpeed: number;
    points: number;
  };
}
export const stage01: StageConfig = {
  id: "stage-01",
  title: "雲際航線",
  duration: 115,
  width: 360,
  height: 640,
  // Small opening formations, alternating flank squadrons, armored batteries,
  // then a quiet resupply lane before the final encounter.
  waves: [
    ...[2, 6, 10].flatMap((at) =>
      [120, 180, 240].map((x, i) => ({
        at: at + i * 0.22,
        x,
        speed: 105,
        hp: 1,
        points: 100,
        behavior: "straight" as const,
      })),
    ),
    ...[15, 19, 23, 27].flatMap((at, group) =>
      [0, 1, 2].map((i) => ({
        at: at + i * 0.48,
        x: group % 2 ? 250 : 110,
        speed: 110,
        hp: 2,
        points: 150,
        behavior: "weave" as const,
        fireEvery: 2.4,
      })),
    ),
    // Optional supply craft: intercept away from the center to choose a weapon.
    ...(["spread", "beam", "missile"] as const).map((drop, i) => ({
      at: 12 + i * 18,
      x: i % 2 ? 390 : -30,
      spawnY: 110,
      direction: i % 2 ? -1 : 1,
      speed: 65,
      hp: 4,
      points: 200,
      behavior: "carrier" as const,
      drop,
    })),
    // Crossing patrols create horizontal interception opportunities for missiles.
    ...[21, 29, 43].flatMap((at, group) =>
      [0, 1, 2].map((i) => ({
        at: at + i * 0.55,
        x: group % 2 ? 390 : -30,
        spawnY: 160 + i * 30,
        direction: group % 2 ? -1 : 1,
        speed: 125,
        hp: 2,
        points: 180,
        behavior: "cross" as const,
      })),
    ),
    // Diving pairs warn, lock a flight line, then commit; no extra bullet curtain.
    ...[34, 52].flatMap((at) =>
      [75, 285].map((x, i) => ({
        at: at + i * 1.2,
        x,
        speed: 140,
        hp: 3,
        points: 240,
        behavior: "dive" as const,
      })),
    ),
    ...[32, 40, 49].flatMap((at) =>
      [80, 280].map((x) => ({
        at,
        x,
        speed: 110,
        hp: 5,
        points: 350,
        behavior: "turret" as const,
        fireEvery: 2.2,
      })),
    ),
    ...[36, 45, 54].map((at) => ({
      at,
      x: 180,
      speed: 95,
      hp: 9,
      points: 150,
      behavior: "heavy" as const,
      fireEvery: 2.8,
    })),
  ].sort((a, b) => a.at - b.at),
  pickups: [
    { at: 5, x: 180, kind: "power" },
    { at: 18, x: 180, kind: "power" },
    { at: 29, x: 180, kind: "heal" },
    { at: 39, x: 180, kind: "support" },
    { at: 60, x: 180, kind: "heal" },
    { at: 67, x: 90, kind: "support" },
  ],
  boss: { at: 70, hp: 400, fireEvery: 2.7, bulletSpeed: 140, points: 3000 },
};
