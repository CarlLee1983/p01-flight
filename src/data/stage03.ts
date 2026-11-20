import type { StageConfig, Wave, Behavior } from "./stage";
import { stageRandom } from "./stage02";
export const STAGE03_REST = [
  [50, 58],
  [108, 117],
  [145, 155],
] as const;
/** Polar front: alternating rail/airfield pressure, recovery bays, radar siege. */
export function createStage03(seed: number): StageConfig {
  const random = stageRandom(seed ^ 0x9e3779b9),
    waves: Wave[] = [];
  const windows = [
    { from: 3, to: 28, role: "weave" },
    { from: 31, to: 49, role: "cross" },
    { from: 58, to: 82, role: "outrider" },
    { from: 84, to: 107, role: "bomber" },
    { from: 117, to: 143, role: "hookWing" },
  ] as const;
  for (const [section, w] of windows.entries()) {
    for (let time = w.from; time < w.to - 1.5; time += 2.8) {
      const side = random() < 0.5 ? -1 : 1,
        at = time + random() * 0.25,
        offset = 8 + random() * 14;
      const specialist = w.role === "outrider" || w.role === "bomber";
      const role: Behavior = specialist
        ? "weave"
        : random() < 0.25
          ? "straight"
          : w.role;
      for (let row = 0; row < (specialist ? 2 : 3); row++)
        for (let lane = 0; lane < 3; lane++) {
          const cross = role === "cross";
          waves.push({
            at: at + row * 0.32 + lane * 0.09,
            x: cross
              ? side === 1
                ? -30
                : 390
              : side === 1
                ? 38 + offset + lane * 44
                : 322 - offset - lane * 44,
            spawnY: cross ? 112 + lane * 48 : undefined,
            direction: side,
            behavior: role,
            speed: 228 + section * 3,
            hp: 1,
            points: 100,
            fireEvery: lane === 0 ? 1.1 : undefined,
            firstFireDelay: lane === 0 ? 0.7 : undefined,
          });
        }
      if (w.role === "outrider")
        for (let i = 0; i < 2; i++)
          waves.push({
            at: at + 0.4 + i * 0.65,
            x: side === 1 ? -30 : 390,
            spawnY: 118 + i * 42,
            direction: side,
            speed: 175,
            hp: 3,
            points: 250,
            behavior: "outrider",
            fireEvery: 1.25,
            firstFireDelay: 0.8,
          });
      if (w.role === "bomber" && Math.floor((time - w.from) / 2.8) % 2 === 0)
        waves.push({
          at: at + 0.7,
          x: 180 + side * 55,
          speed: 55,
          hp: 14,
          points: 750,
          behavior: "bomber",
          fireEvery: 2.7,
          firstFireDelay: 1.3,
        });
    }
  }
  const ground: [number, Behavior, number][] = [
    [19, "groundBattery", 55],
    [33, "missileTruck", 302],
    [43, "flakBattery", 55],
    [64, "groundBattery", 302],
    [75, "missileTruck", 58],
    [90, "flakBattery", 302],
    [102, "groundBattery", 55],
    [124, "missileTruck", 302],
    [135, "flakBattery", 58],
  ];
  for (const [at, behavior, x] of ground)
    waves.push({
      at,
      x,
      spawnY: 85,
      speed: 32,
      hp: behavior === "groundBattery" ? 12 : 15,
      points: 650,
      behavior,
      fireEvery: behavior === "flakBattery" ? 3.2 : 2.8,
      firstFireDelay: 1.6,
    });
  for (const [i, at] of [16, 46, 78, 104, 138].entries())
    waves.push({
      at,
      x: i % 2 ? 390 : -30,
      spawnY: 145,
      direction: i % 2 ? -1 : 1,
      speed: 100,
      hp: 3,
      points: 250,
      behavior: "carrier",
      drop: "power",
    });
  for (const at of [51, 109, 146])
    waves.push({
      at,
      x: at === 109 ? 302 : 58,
      spawnY: 90,
      speed: 32,
      hp: 5,
      points: 250,
      behavior: "groundDepot",
      groundSurface: at === 146 ? "water" : "land",
      drop: "support",
    });
  return {
    id: "stage-03",
    title: "極光前哨",
    width: 360,
    height: 640,
    duration: 205,
    groundSpeed: 32,
    enemyBurstShots: 2,
    waves: waves.sort((a, b) => a.at - b.at),
    sections: [
      {
        id: "ice",
        at: 0,
        title: "碎冰入口",
        hint: "斜切敵機穿越兩翼，保留中央退路",
      },
      {
        id: "rail",
        at: 31,
        title: "鐵道封鎖",
        hint: "飛彈車鎖定後移位，防空砲扇形保留空隙",
      },
      { id: "recover", at: 50, title: "冰灣整備", hint: "整理武器，補充生命" },
      {
        id: "airfield",
        at: 58,
        title: "雪原機場",
        hint: "斜切襲擊機與快機交替進場",
      },
      {
        id: "bombers",
        at: 84,
        title: "重裝巡航",
        hint: "轟炸機慢彈封鎖，移位後反擊",
      },
      { id: "rest", at: 108, title: "極夜補給", hint: "整備後進入雷達防線" },
      {
        id: "radar",
        at: 117,
        title: "雷達前哨",
        hint: "分散處理地面目標，避免停在鎖定位置",
      },
      {
        id: "supply",
        at: 145,
        title: "最後整備",
        hint: "補充生命，準備迎戰極地雷眼",
      },
      {
        id: "boss",
        at: 155,
        title: "極地雷眼",
        hint: "擊破護甲供能環，趁核心開放反擊",
      },
    ],
    pickups: [
      { at: 6, x: 180, kind: "power" },
      { at: 27, x: 180, kind: "heal" },
      { at: 49, x: 180, kind: "missile" },
      { at: 52, x: 180, kind: "heal" },
      { at: 54, x: 180, kind: "support" },
      { at: 80, x: 180, kind: "beam" },
      { at: 106, x: 180, kind: "heal" },
      { at: 111, x: 180, kind: "support" },
      { at: 143, x: 180, kind: "power" },
      { at: 147, x: 180, kind: "heal" },
      { at: 150, x: 180, kind: "support" },
    ],
    boss: {
      at: 155,
      hp: 320,
      sideCannonHp: 28,
      fireEvery: 1.2,
      bulletSpeed: 150,
      burstShots: 4,
      points: 8500,
      pattern: "polar",
      skin: "polarRadar",
    },
  };
}
