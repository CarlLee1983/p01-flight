export type Behavior = "straight" | "weave" | "turret";
export type PickupKind = "heal" | "double" | "power";
export interface Wave {
  at: number;
  x: number;
  speed: number;
  hp: number;
  points: number;
  behavior?: Behavior;
  fireEvery?: number;
  drop?: PickupKind;
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
  duration: 75,
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
    ...[32, 38].flatMap((at) =>
      [80, 280].map((x) => ({
        at,
        x,
        speed: 110,
        hp: 10,
        points: 350,
        behavior: "turret" as const,
        fireEvery: 2.2,
      })),
    ),
    ...[34, 40].map((at) => ({
      at,
      x: 180,
      speed: 125,
      hp: 3,
      points: 150,
      behavior: "straight" as const,
    })),
  ].sort((a, b) => a.at - b.at),
  pickups: [
    { at: 5, x: 180, kind: "power" },
    { at: 18, x: 180, kind: "power" },
    { at: 29, x: 180, kind: "heal" },
    { at: 46, x: 180, kind: "heal" },
  ],
  boss: { at: 55, hp: 180, fireEvery: 2.5, bulletSpeed: 140, points: 3000 },
};
