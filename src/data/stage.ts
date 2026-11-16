export type Behavior = "straight" | "weave" | "turret";
export type PickupKind = "heal" | "double";
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
  waves: Array.from({ length: 32 }, (_, i) => ({
    at: 1.5 + i * 1.45,
    x: [70, 180, 290, 120, 240, 180][i % 6],
    speed: 95 + Math.floor(i / 12) * 15,
    hp: i % 4 === 0 ? 2 : 1,
    points: i % 6 === 0 ? 150 : 100,
    behavior:
      i > 7 && i % 6 === 0
        ? "turret"
        : i > 3 && i % 3 === 0
          ? "weave"
          : "straight",
    fireEvery: i > 7 && i % 6 === 0 ? 1.8 : undefined,
    drop: i === 6 ? "double" : undefined,
  })),
  pickups: [
    { at: 9, x: 180, kind: "double" },
    { at: 27, x: 180, kind: "heal" },
    { at: 44, x: 180, kind: "heal" },
  ],
  boss: { at: 58, hp: 65, fireEvery: 2.8, bulletSpeed: 145, points: 2500 },
};
