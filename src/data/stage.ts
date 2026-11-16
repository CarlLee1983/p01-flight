export const GROUND_SCROLL_SPEED = 32;
export type Behavior =
  | "straight"
  | "weave"
  | "turret"
  | "heavy"
  | "dive"
  | "cross"
  | "carrier"
  | "groundBattery"
  | "groundDepot"
  | "gatekeeper";
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
  holdFor?: number;
  strafeWidth?: number;
}
export interface StageSection {
  id: string;
  title: string;
  at: number;
  hint: string;
}
export interface StageConfig {
  id: string;
  title: string;
  duration: number;
  groundSpeed?: number;
  width: number;
  height: number;
  waves: Wave[];
  sections?: StageSection[];
  pickups?: { at: number; x: number; kind: PickupKind }[];
  boss?: {
    at: number;
    hp: number;
    fireEvery: number;
    bulletSpeed: number;
    sideCannonHp?: number;
    points: number;
  };
}
export const stage01: StageConfig = {
  id: "stage-01",
  title: "雲際航線",
  duration: 115,
  groundSpeed: GROUND_SCROLL_SPEED,
  sections: [
    {
      id: "approach",
      title: "外海試探",
      at: 0,
      hint: "擊破小隊，取得主炮升級",
    },
    {
      id: "crossing",
      title: "交叉航道",
      at: 15,
      hint: "側向敵機可用追蹤彈攔截",
    },
    {
      id: "harbor",
      title: "港區火力",
      at: 32,
      hint: "看見蓄力光圈，側移避開瞄準彈",
    },
    {
      id: "blockade",
      title: "突破封鎖",
      at: 40,
      hint: "先避開預告航道，再追擊橫移封鎖艦；集中火力可取得升級補給",
    },
    {
      id: "push",
      title: "最後推進",
      at: 50,
      hint: "看清俯衝方向，穿越最後一組攔截機",
    },
    {
      id: "resupply",
      title: "補給接近",
      at: 56,
      hint: "整隊補血，保留炸彈迎擊指揮艦",
    },
    {
      id: "commander",
      title: "指揮艦",
      at: 70,
      hint: "擊破兩側炮座可減少外側火力；核心擊破即通關",
    },
  ],
  width: 360,
  height: 640,
  // Small opening formations, alternating flank squadrons, armored batteries,
  // then a quiet resupply lane before the final encounter.
  waves: [
    ...[2, 6, 10].flatMap((at, group) =>
      [
        [120, 180, 240],
        [90, 150, 210],
        [270, 210, 150],
      ][group].map((x, i) => ({
        at: at + (group === 0 ? [0.22, 0, 0.22][i] : i * 0.22),
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
    ...[34, 50].flatMap((at) =>
      [75, 285].map((x, i) => ({
        at: at + i * 1.2,
        x,
        speed: 140,
        hp: 3,
        points: 240,
        behavior: "dive" as const,
      })),
    ),
    ...[32].flatMap((at) =>
      [80, 280].map((x) => ({
        at,
        x,
        speed: 110,
        hp: at === 32 ? 12 : 5,
        points: 350,
        behavior: at === 32 ? ("groundBattery" as const) : ("turret" as const),
        fireEvery: at === 32 ? 4.8 : 2.2,
      })),
    ),
    ...[36].map((at) => ({
      at,
      x: at === 36 ? 270 : 180,
      speed: 95,
      hp: at === 36 ? 4 : 9,
      points: 150,
      behavior: at === 36 ? ("groundDepot" as const) : ("heavy" as const),
      fireEvery: at === 36 ? undefined : 2.8,
      drop: at === 36 ? ("heal" as const) : undefined,
    })),
    {
      at: 40,
      x: 180,
      speed: 130,
      hp: 64,
      points: 1000,
      behavior: "gatekeeper" as const,
      fireEvery: 2.2,
      holdFor: 9,
      strafeWidth: 75,
      drop: "power" as const,
    },
  ].sort((a, b) => a.at - b.at),
  pickups: [
    { at: 5, x: 180, kind: "power" },
    { at: 18, x: 180, kind: "power" },
    { at: 29, x: 180, kind: "heal" },
    { at: 39, x: 180, kind: "support" },
    { at: 60, x: 180, kind: "heal" },
    { at: 67, x: 90, kind: "support" },
  ],
  boss: {
    at: 70,
    hp: 400,
    fireEvery: 2.7,
    bulletSpeed: 140,
    sideCannonHp: 24,
    points: 3000,
  },
};
