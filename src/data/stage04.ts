import type { Behavior, StageConfig, Wave } from "./stage";
import { stageRandom } from "./stage02";

/** Launch apron, blockade, recovery, then the climb through the relay wall. */
export function createStage04(seed: number): StageConfig {
  const random = stageRandom(seed ^ 0xde1265a3);
  const waves: Wave[] = [];

  // Keep the set pieces fixed. Vary the arrival side and placement of each
  // formation within its assigned timing window so a retry is learnable.
  function flights(
    from: number,
    through: number,
    interval: number,
    roles: readonly Behavior[],
  ) {
    for (let i = 0, at = from; at <= through; i++, at += interval) {
      const behavior = roles[i % roles.length];
      const direction = random() < 0.5 ? -1 : 1;
      const jitter = (random() - 0.5) * 16;
      const lateral = behavior === "cross" || behavior === "outrider";
      const count = behavior === "outrider" ? 2 : 6;
      for (let j = 0; j < count; j++) {
        const lane = j % 3;
        const row = Math.floor(j / 3);
        const lead = lane === 0 && row === 0;
        waves.push({
          at: at + row * 0.45 + lane * (lateral ? 0.24 : 0.1),
          x: lateral
            ? direction === 1
              ? -28
              : 388
            : 180 + direction * (-93 + lane * 53 + row * 21) + jitter,
          spawnY: lateral ? 106 + lane * 45 + row * 14 : undefined,
          direction,
          behavior,
          speed: behavior === "outrider" ? 178 : 235 - row * 13,
          hp: behavior === "outrider" ? 3 : 1,
          points: behavior === "outrider" ? 250 : 100,
          fireEvery: lead ? 1.25 : undefined,
          firstFireDelay: lead ? 0.72 : undefined,
        });
      }
    }
  }

  flights(3, 23, 3.2, ["straight", "cross", "weave"]);
  flights(26, 46, 2.75, ["cross", "hookWing", "outrider", "weave"]);

  // Give the mini-boss a clean entrance before escorts arrive. It can be
  // defeated for an upgrade or outrun; it isn't a timer gate.
  waves.push({
    at: 52,
    x: 180,
    speed: 125,
    hp: 82,
    points: 2500,
    behavior: "gatekeeper",
    sustain: "lance",
    fireEvery: 2.7,
    holdFor: 14,
    strafeWidth: 66,
    drop: "power",
  });
  flights(58, 64, 6, ["outrider", "cross"]);

  flights(82, 105, 2.75, ["outrider", "cross", "hookWing", "brakeRaider"]);
  flights(110, 132, 2.6, ["weave", "cross", "outrider", "hookWing"]);
  for (const [at, x] of [
    [85.5, 257],
    [99.5, 106],
    [117.3, 243],
    [130.7, 106],
  ]) {
    waves.push({
      at,
      x,
      speed: 66,
      hp: 17,
      points: 850,
      behavior: "bomber",
      fireEvery: 2.75,
      firstFireDelay: 1.1,
    });
  }

  for (const [at, x, behavior] of [
    [14, 62, "groundBattery"],
    [20, 298, "flakBattery"],
    [31, 54, "missileTruck"],
    [36, 306, "groundBattery"],
    [89, 61, "flakBattery"],
    [96, 299, "missileTruck"],
    [113, 54, "groundBattery"],
    [119, 306, "flakBattery"],
  ] as const) {
    waves.push({
      at,
      x,
      spawnY: 96,
      speed: 38,
      hp: behavior === "missileTruck" ? 14 : 17,
      points: 700,
      behavior,
      fireEvery: behavior === "flakBattery" ? 3.1 : 2.9,
      firstFireDelay: 1.6,
    });
  }

  for (const [i, at] of [17, 43, 92, 123].entries()) {
    const direction = i % 2 === 0 ? 1 : -1;
    waves.push({
      at,
      x: direction === 1 ? -28 : 388,
      spawnY: 144,
      direction,
      speed: 97,
      hp: 4,
      points: 300,
      behavior: "carrier",
      drop: "power",
    });
  }

  return {
    id: "stage-04",
    title: "雲頂發射場",
    width: 360,
    height: 640,
    duration: 205,
    groundSpeed: 38,
    enemyBurstShots: 2,
    waves: waves.sort((a, b) => a.at - b.at),
    sections: [
      {
        id: "apron",
        at: 0,
        title: "發射場外圍",
        hint: "從機棚間切入，迎擊升空編隊",
      },
      {
        id: "ramp",
        at: 26,
        title: "升空跑道",
        hint: "先避開飛彈車的鎖定，再截擊側翼",
      },
      {
        id: "blockade",
        at: 52,
        title: "升空攔截艦",
        hint: "攔截艦瞄準充能後會持續射擊，先離開鎖定位置",
      },
      {
        id: "resupply",
        at: 72,
        title: "雲海補給",
        hint: "回收機身補給，準備穿過高空中繼站",
      },
      {
        id: "climb",
        at: 82,
        title: "穿越雲層",
        hint: "快機從側面切入，轟炸機從高處壓下",
      },
      {
        id: "relay",
        at: 110,
        title: "中繼塔防線",
        hint: "優先擊破防空砲台，保留橫移空間",
      },
      {
        id: "last-call",
        at: 138,
        title: "塔頂整備",
        hint: "整備武器，接著迎戰天門陣列",
      },
      {
        id: "boss",
        at: 148,
        title: "天門陣列",
        hint: "雷射充能時先離開該航道，熄火後回擊",
      },
    ],
    pickups: [
      { at: 7, x: 180, kind: "power" },
      { at: 25, x: 180, kind: "heal" },
      { at: 46, x: 180, kind: "power" },
      { at: 49, x: 180, kind: "missile" },
      { at: 72, x: 180, kind: "heal" },
      { at: 75, x: 180, kind: "support" },
      { at: 103, x: 180, kind: "heal" },
      { at: 125, x: 180, kind: "beam" },
      { at: 137, x: 180, kind: "heal" },
      { at: 140, x: 180, kind: "power" },
      { at: 143, x: 180, kind: "support" },
    ],
    boss: {
      at: 148,
      hp: 355,
      sideCannonHp: 32,
      fireEvery: 1.2,
      bulletSpeed: 163,
      burstShots: 4,
      points: 11500,
      pattern: "ascent",
      skin: "ascentGate",
    },
  };
}
