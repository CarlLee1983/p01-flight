import type { StageConfig, Wave, Behavior } from "./stage";

/** Uint32 PRNG: no runtime randomness after stage creation. */
export function stageRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = value;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export const STAGE02_WINDOWS = [
  { from: 3, to: 25, interval: 3.2, role: "weave" },
  { from: 30, to: 53, interval: 2.9, role: "cross" },
  { from: 58, to: 83, interval: 2.8, role: "brakeRaider" },
  { from: 92, to: 117, interval: 2.7, role: "hookWing" },
  { from: 123, to: 137, interval: 2.8, role: "weave" },
] as const;
export function createStage02(seed: number): StageConfig {
  const random = stageRandom(seed);
  const waves: Wave[] = [];
  for (const [section, window] of STAGE02_WINDOWS.entries()) {
    for (
      let time = window.from;
      time < window.to - 1.5;
      time += window.interval
    ) {
      const side = random() < 0.5 ? -1 : 1;
      const variation = random();
      const role: Behavior = variation < 0.22 ? "straight" : window.role;
      const at = time + random() * 0.3;
      const offset = 8 + random() * 16;
      // A formation shares its geometry: independently randomizing every plane
      // would collapse lanes. No sudden airborne spawns inside the player area.
      for (let row = 0; row < 3; row++) {
        for (let lane = 0; lane < 3; lane++) {
          const cross = role === "cross";
          waves.push({
            at: at + row * 0.32 + lane * 0.09,
            x: cross
              ? side === 1
                ? -30
                : 390
              : side === 1
                ? 35 + offset + lane * 45
                : 325 - offset - lane * 45,
            spawnY: cross ? 112 + lane * 48 : undefined,
            direction: side,
            behavior: role,
            speed: role === "brakeRaider" ? 215 : 225 + section * 3,
            hp: 1,
            points: 90,
            // One gunner per row; same readable twin-shot emitter as Stage01.
            fireEvery: lane === 0 ? 1.0 : undefined,
            firstFireDelay: lane === 0 ? 0.65 : undefined,
          });
        }
      }
    }
  }
  // Ground emplacements / depots follow road shoulders, not random air lanes.
  for (const [i, at] of [29, 42, 60, 73, 96, 109, 124].entries()) {
    waves.push({
      at,
      x: i % 2 ? 310 : 50,
      spawnY: 85,
      speed: 32,
      hp: 12,
      points: 500,
      behavior: "groundBattery",
      fireEvery: 2.2,
      firstFireDelay: 1.3,
    });
  }
  for (const at of [26, 85, 138])
    waves.push({
      at,
      x: 180,
      spawnY: 90,
      speed: 32,
      hp: 5,
      points: 250,
      behavior: "groundDepot",
      drop: "support",
    });
  waves.push({
    at: 59,
    x: 180,
    spawnY: -70,
    speed: 90,
    hp: 26,
    points: 1800,
    behavior: "gatekeeper",
    holdFor: 8,
    strafeWidth: 65,
    fireEvery: 2.6,
  });
  for (const [i, at] of [17, 48, 80, 112, 134].entries())
    waves.push({
      at,
      x: i % 2 ? 390 : -30,
      spawnY: 145,
      direction: i % 2 ? -1 : 1,
      speed: 100,
      hp: 3,
      points: 200,
      behavior: "carrier",
      drop: "power",
    });
  // Specialist inserts are fixed readable encounters; seeded flights remain unchanged.
  for (const [i,at] of [38,40,102,104].entries()) waves.push({at,x:i%2?390:-30,spawnY:118,direction:i%2?-1:1,speed:170,hp:3,points:220,behavior:"outrider",fireEvery:1.15,firstFireDelay:0.7});
  for (const at of [66,128]) waves.push({at,x:180,speed:58,hp:12,points:650,behavior:"bomber",fireEvery:2.6,firstFireDelay:1.1});
  waves.push({at:45,x:58,spawnY:85,speed:32,hp:12,points:600,behavior:"missileTruck",fireEvery:2.8,firstFireDelay:1.5});
  waves.push({at:100,x:302,spawnY:85,speed:32,hp:14,points:650,behavior:"flakBattery",fireEvery:3,firstFireDelay:1.6});
  return {
    id: "stage-02",
    title: "赤岩峽谷",
    width: 360,
    height: 640,
    duration: 190,
    groundSpeed: 32,
    enemyBurstShots: 2,
    waves: waves.sort((a, b) => a.at - b.at),
    sections: [
      { id: "mesa", at: 0, title: "赤岩入口", hint: "交替編隊，沿河谷進入" },
      {
        id: "bridge",
        at: 29,
        title: "鐵橋防線",
        hint: "先處理兩岸地炮，再追擊側向敵機",
      },
      {
        id: "ambush",
        at: 58,
        title: "礦區伏擊",
        hint: "巡邏艦與煞停機交錯登場",
      },
      { id: "rest", at: 84, title: "補給河灣", hint: "整理武器，補充生命" },
      { id: "climb", at: 92, title: "峽谷突圍", hint: "鉤翼編隊由兩側切入" },
      { id: "dam", at: 123, title: "水壩防線", hint: "清除地炮，準備迎戰" },
      {
        id: "supply",
        at: 138,
        title: "最後整備",
        hint: "保留炸彈，兩側砲座可破壞",
      },
      { id: "boss", at: 145, title: "鐵閘守衛", hint: "觀察炮口，輪替閃避" },
    ],
    pickups: [
      { at: 6, x: 180, kind: "power" },
      { at: 24, x: 180, kind: "heal" },
      { at: 54, x: 180, kind: "beam" },
      { at: 86, x: 180, kind: "heal" },
      { at: 88, x: 180, kind: "support" },
      { at: 118, x: 180, kind: "heal" },
      { at: 139, x: 180, kind: "power" },
      { at: 141, x: 180, kind: "heal" },
    ],
    boss: {
      pattern: "canyon",
      skin: "riverFortress",
      at: 145,
      hp: 175,
      fireEvery: 1.2,
      bulletSpeed: 150,
      burstShots: 4,
      sideCannonHp: 24,
      points: 7000,
    },
  };
}
