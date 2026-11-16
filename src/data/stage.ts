export const GROUND_SCROLL_SPEED = 32;
export const GROUND_VISIBLE_Y = 108;
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
  | "gatekeeper"
  | "escort";
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
  firstFireDelay?: number;
  drop?: PickupKind;
  spawnY?: number;
  direction?: number;
  holdFor?: number;
  strafeWidth?: number;
  formationPhase?: number;
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
  duration: 170,
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
      title: "突破第一道封鎖",
      at: 50,
      hint: "看清俯衝方向，穿越第一道攔截線",
    },
    {
      id: "resupply",
      title: "港外護航",
      at: 56,
      hint: "躲開護航扇射，再收取修復補給",
    },
    {
      id: "pressure",
      title: "港區壓制",
      at: 62,
      hint: "攔截側入機，優先處理岸邊瞄準砲台",
    },
    {
      id: "escort-run",
      title: "護航航道",
      at: 78,
      hint: "追擊側翼護航機，預告亮起時移出瞄準線",
    },
    {
      id: "recovery",
      title: "補給轉向",
      at: 96,
      hint: "收取修復，準備出口突圍",
    },
    {
      id: "breakout",
      title: "出口突圍",
      at: 102,
      hint: "移位避開重裝扇射，穿過交叉編隊",
    },
    {
      id: "regroup",
      title: "整隊接近",
      at: 121,
      hint: "確認武器與炸彈，迎擊指揮艦",
    },
    {
      id: "commander",
      title: "指揮艦",
      at: 125,
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
    // Two staggered escort flights: one telegraphed volley per aircraft.
    ...[12, 58].flatMap((at) =>
      [60, 180, 300].map((x, i) => ({
        at: at + i * 0.8,
        x,
        speed: 140,
        hp: 4,
        points: 160,
        behavior: "escort" as const,
        formationPhase: i * 0.8,
      })),
    ),
    // Opposing interception pairs add movement, not additional bullets.
    ...[24, 37].flatMap((at) =>
      [-1, 1].map((direction, i) => ({
        at: at + i * 0.7,
        x: direction === 1 ? -30 : 390,
        spawnY: 230 + i * 45,
        direction,
        speed: 150,
        hp: 2,
        points: 180,
        behavior: "cross" as const,
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
        hp: at === 32 ? 18 : 5,
        points: 350,
        behavior: at === 32 ? ("groundBattery" as const) : ("turret" as const),
        fireEvery: at === 32 ? 4.8 : 2.2,
        firstFireDelay: 0.9,
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
    // Harbor pressure: alternating flanks, not a repeated full-screen wave.
    ...[64, 68].flatMap((at, group) =>
      [0, 1, 2].map((i) => ({
        at: at + i * 0.45,
        x: group ? 255 : 105,
        speed: 125,
        hp: 3,
        points: 170,
        behavior: "weave" as const,
        fireEvery: 2.6,
      })),
    ),
    ...[60, 300].map((x, i) => ({
      at: 70 + i * 1.2,
      x,
      speed: 32,
      hp: 18,
      points: 350,
      behavior: "groundBattery" as const,
      fireEvery: 4.8,
      firstFireDelay: 0.9,
    })),
    ...[78, 86].flatMap((at, group) =>
      [60, 180, 300].map((x, i) => ({
        at: at + i * 0.9,
        x: group ? 360 - x : x,
        speed: 145,
        hp: 4,
        points: 160,
        behavior: "escort" as const,
        formationPhase: i * 0.9,
      })),
    ),
    ...[66, 82, 94, 108].flatMap((at) =>
      [0, 1, 2, 3].map((i) => ({
        at: at + i * 0.55,
        x: i % 2 ? -30 : 390,
        spawnY: 150 + i * 32,
        direction: i % 2 ? 1 : -1,
        speed: 145,
        hp: 2,
        points: 180,
        behavior: "cross" as const,
      })),
    ),
    ...[90, 102].flatMap((at) =>
      [80, 280].map((x, i) => ({
        at: at + i * 1.1,
        x,
        speed: 150,
        hp: 3,
        points: 240,
        behavior: "dive" as const,
      })),
    ),
    ...[88, 106].map((at, i) => ({
      at,
      x: i ? 235 : 125,
      speed: 110,
      hp: 9,
      points: 300,
      behavior: "heavy" as const,
      fireEvery: 2.8,
    })),
    ...[98, 112].flatMap((at, group) =>
      [0, 1, 2].map((i) => ({
        at: at + i * 0.5,
        x: group ? 250 : 110,
        speed: 145,
        hp: 2,
        points: 150,
        behavior: "weave" as const,
        fireEvery: 2.8,
      })),
    ),
    ...[110, 180, 250].map((x, i) => ({
      at: 116 + i * 0.2,
      x,
      speed: 180,
      hp: 2,
      points: 120,
      behavior: "straight" as const,
    })),
    ...[73, 93, 114].map((at, i) => ({
      at,
      x: i % 2 ? 390 : -30,
      spawnY: 120,
      direction: i % 2 ? -1 : 1,
      speed: 85,
      hp: 4,
      points: 200,
      behavior: "carrier" as const,
      drop: "support" as const,
    })),
  ].sort((a, b) => a.at - b.at),
  pickups: [
    { at: 5, x: 180, kind: "power" },
    { at: 18, x: 180, kind: "power" },
    { at: 29, x: 180, kind: "heal" },
    { at: 39, x: 180, kind: "support" },
    { at: 60, x: 180, kind: "heal" },
    { at: 67, x: 90, kind: "support" },
    { at: 74, x: 180, kind: "heal" },
    { at: 84, x: 270, kind: "power" },
    { at: 96, x: 180, kind: "heal" },
    { at: 108, x: 90, kind: "support" },
    { at: 118, x: 180, kind: "heal" },
  ],
  boss: {
    at: 125,
    hp: 400,
    fireEvery: 2.7,
    bulletSpeed: 140,
    sideCannonHp: 24,
    points: 3000,
  },
};
