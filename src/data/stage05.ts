import type { StageConfig, Wave } from "./stage";
import { stageRandom } from "./stage02";

export const STAGE05_BOSS_AT = 164;
export const STAGE05_REST = [
  [67, 78],
  [151, STAGE05_BOSS_AT],
] as const;

/** A frontier with identifiable encounters: orbit, wreck field, station, and gate. */
export function createStage05(seed: number): StageConfig {
  const random = stageRandom(seed ^ 0x5e5f091f);
  const waves: Wave[] = [];
  type Side = -1 | 1;
  const sideAt = (i: number, first: Side): Side =>
    i % 2 === 0 ? first : first === 1 ? -1 : 1;
  const sideOf = (): Side => (random() < 0.5 ? -1 : 1);
  const edge = (side: Side) => (side === 1 ? -32 : 392);
  const jitter = (range: number) => (random() - 0.5) * range;

  // A formation randomizes as a unit so consecutive launches never stack by accident.
  // Negative y lets every top-entry silhouette scroll into view before it can fire.
  function flight(
    at: number,
    side: Side,
    role: "weave" | "straight" | "hookWing" | "brakeRaider" | "escort",
    rows: number,
    pace: number,
  ) {
    const shift = jitter(14);
    const gunner = Math.floor(random() * 3);
    for (let row = 0; row < rows; row++)
      for (let lane = 0; lane < 3; lane++)
        waves.push({
          at: at + row * 0.35 + lane * 0.11,
          x: 180 + side * (120 - lane * 43 + shift),
          direction: side === 1 ? -1 : 1,
          behavior: role,
          speed: pace,
          hp: role === "escort" ? 2 : 1,
          points: role === "escort" ? 180 : 110,
          fireEvery: lane === gunner ? 1.2 : undefined,
          firstFireDelay: lane === gunner ? 0.72 : undefined,
          // Escort volleys are intrinsic, so only use two rows of other roles.
          formationPhase: lane * 0.45,
        });
  }

  function flank(
    at: number,
    side: Side,
    role: "cross" | "outrider",
    y: number,
  ) {
    for (let i = 0; i < 3; i++)
      waves.push({
        at: at + i * 0.34,
        x: edge(side),
        spawnY: y + i * 28,
        direction: side,
        behavior: role,
        speed: role === "cross" ? 221 : 168,
        hp: role === "cross" ? 1 : 3,
        points: role === "cross" ? 120 : 270,
        fireEvery: i === 0 || role === "outrider" ? 1.3 : undefined,
        firstFireDelay: i === 0 || role === "outrider" ? 0.9 : undefined,
      });
  }

  function emplacement(
    at: number,
    x: number,
    behavior: "flakBattery" | "missileTruck",
  ) {
    waves.push({
      at,
      x,
      spawnY: 86,
      speed: 31,
      hp: behavior === "flakBattery" ? 15 : 17,
      behavior,
      points: 750,
      fireEvery: behavior === "flakBattery" ? 3.4 : 3,
      firstFireDelay: 1.7,
    });
  }

  const orbitSide = sideOf();
  for (const [i, at] of [4, 8, 12, 16, 20, 24, 28].entries())
    flight(
      at + jitter(0.3),
      sideAt(i, orbitSide),
      i % 3 === 2 ? "weave" : "straight",
      2,
      212,
    );

  // Wreck corridor: a diagonal warning shape from the outriders, then a crossing
  // pass from the opposite side. Bombers leave centre open until the next flight.
  const wreckSide = sideOf();
  for (const [i, at] of [35, 41, 47, 53, 59].entries()) {
    const side = sideAt(i, wreckSide);
    flank(at + jitter(0.3), side, "outrider", 114);
    flank(at + 2.2, side === 1 ? -1 : 1, "cross", 166);
    if (i === 1 || i === 3)
      waves.push({
        at: at + 0.5,
        x: 180 - side * 68,
        behavior: "bomber",
        speed: 110,
        hp: 12,
        points: 800,
        fireEvery: 2.7,
        firstFireDelay: 1.25,
      });
  }

  // The station shoulders are fixed so the level art has somewhere to mount
  // its anti-air emplacements. Air squads still vary their entry by seed.
  const blockSide = sideOf();
  for (const [i, at] of [79, 84.8, 90.6, 96.4, 102.2, 108].entries()) {
    const side = sideAt(i, blockSide);
    flight(at + jitter(0.4), side, i % 2 ? "hookWing" : "brakeRaider", 2, 205);
    if (i % 2 === 0) flank(at + 2, side === 1 ? -1 : 1, "cross", 125);
  }
  emplacement(80, 58, "missileTruck");
  emplacement(91, 302, "flakBattery");
  emplacement(102, 58, "flakBattery");

  // The star gate guard is a set-piece, not another random squad. Let its
  // left/right/aim sequence play without simultaneous reinforcement for 12s.
  waves.push({
    at: 116,
    x: 180,
    spawnY: -64,
    behavior: "gatekeeper",
    speed: 94,
    hp: 36,
    points: 2400,
    holdFor: 11,
    strafeWidth: 57,
    fireEvery: 2.45,
  });
  for (const [i, at] of [131, 136, 141, 146].entries()) {
    const side = sideAt(i, blockSide);
    flight(at + jitter(0.35), side, "escort", 1, 184);
    flank(at + 1.65, side === 1 ? -1 : 1, i % 2 ? "outrider" : "cross", 132);
  }

  // Side escorts mark the occupied lane in succession. One aim tell per craft,
  // half a second apart, keeps cutting back immediately after a dodge risky
  // without closing both exits at once.
  for (const [event, at] of [83, 100, 132, 144].entries())
    for (const [wing, x] of [65, 295].entries())
      waves.push({
        at: at + wing * 0.5,
        x,
        speed: 149,
        hp: 3,
        points: 200,
        behavior: "escort",
        formationPhase: event * 0.6 + wing * 0.4,
      });

  // Interceptable replacements reward accuracy; guaranteed supply also makes a
  // Stage 05 replay viable without upgrades carried in from the earlier maps.
  for (const [i, at] of [18, 45, 87, 138].entries()) {
    const side = sideAt(i, orbitSide);
    waves.push({
      at,
      x: edge(side),
      direction: side,
      spawnY: 142,
      speed: 102,
      hp: 3,
      points: 250,
      behavior: "carrier",
      drop: "power",
    });
  }

  return {
    id: "stage-05",
    title: "星門決戰",
    width: 360,
    height: 640,
    duration: 224,
    groundSpeed: 31,
    enemyBurstShots: 2,
    waves: waves.sort((a, b) => a.at - b.at),
    sections: [
      {
        id: "orbit",
        at: 0,
        title: "近地軌道",
        hint: "敵群交替進場，先攔截補給機",
      },
      {
        id: "debris",
        at: 34,
        title: "殘骸航道",
        hint: "先避開斜掠機，再看另一側的橫切隊",
      },
      {
        id: "reserve",
        at: 67,
        title: "軌道補給",
        hint: "回到中央接補給，準備攻入軌道站",
      },
      {
        id: "blockade",
        at: 78,
        title: "軌道站封鎖線",
        hint: "鎖定後移位，趁砲台停火處理側翼",
      },
      {
        id: "breach",
        at: 114,
        title: "突破星門",
        hint: "守門機輪流封鎖兩側，留出轉向空間",
      },
      {
        id: "last-supply",
        at: 151,
        title: "終戰整備",
        hint: "補充生命及火力，迎戰星門核心",
      },
      {
        id: "boss",
        at: STAGE05_BOSS_AT,
        title: "星門核心",
        hint: "看清充能位置，穿過空檔後回擊核心",
      },
    ],
    pickups: [
      { at: 6, x: 180, kind: "power" },
      { at: 23, x: 180, kind: "heal" },
      { at: 32, x: 180, kind: "missile" },
      { at: 50, x: 180, kind: "heal" },
      { at: 69, x: 180, kind: "heal" },
      { at: 72, x: 180, kind: "beam" },
      { at: 74, x: 180, kind: "support" },
      { at: 97, x: 180, kind: "heal" },
      { at: 111, x: 180, kind: "missile" },
      { at: 129, x: 180, kind: "heal" },
      { at: 145, x: 180, kind: "power" },
      { at: 152, x: 180, kind: "heal" },
      { at: 155, x: 180, kind: "power" },
      { at: 158, x: 180, kind: "support" },
    ],
    boss: {
      at: STAGE05_BOSS_AT,
      hp: 370,
      sideCannonHp: 24,
      fireEvery: 1.1,
      bulletSpeed: 162,
      burstShots: 4,
      points: 12500,
      pattern: "orbital",
      skin: "orbitalLattice",
    },
  };
}
