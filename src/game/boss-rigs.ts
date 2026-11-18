/** Three concrete rigs share geometry contracts, not a universal enemy engine. */
export type BossSkin = "command" | "riverFortress" | "polarRadar";
export type BossPhase = 1 | 2 | 3;
export interface BossPose {
  x: number;
  y: number;
  roll: number;
  ringAngle: number;
  state: string;
  entered: boolean;
  canFire: boolean;
  fireWindow: number;
}
export interface BossRig {
  key: string;
  width: number;
  height: number;
  partCount: number;
  partKey: string;
  wreckKey: string;
  partWidth: number;
  partHeight: number;
  muzzleY: number;
  partLabel: string;
  support: boolean;
  halfWidth: number;
  halfHeight: number;
  partHalfWidth: number;
  partHalfHeight: number;
  entrySeconds: number;
  restY: number;
}
const RIGS: Record<BossSkin, BossRig> = {
  command: {
    key: "boss",
    width: 120,
    height: 62,
    partCount: 2,
    partKey: "boss-cannon",
    wreckKey: "boss-cannon-broken",
    partWidth: 32,
    partHeight: 48,
    muzzleY: 22,
    partLabel: "翼炮",
    support: true,
    halfWidth: 50,
    halfHeight: 29,
    partHalfWidth: 14,
    partHalfHeight: 20,
    entrySeconds: 2.1,
    restY: 150,
  },
  riverFortress: {
    key: "boss-river-hull-v2",
    width: 64,
    height: 184,
    partCount: 3,
    partKey: "boss-river-turret-v2",
    wreckKey: "boss-river-turret-wreck-v2",
    partWidth: 32,
    partHeight: 56,
    muzzleY: 22,
    partLabel: "甲板炮",
    support: false,
    halfWidth: 28,
    halfHeight: 78,
    partHalfWidth: 12,
    partHalfHeight: 16,
    entrySeconds: 2.5,
    restY: 185,
  },
  polarRadar: {
    key: "boss-polar-rotor-v2",
    width: 104,
    height: 104,
    partCount: 4,
    partKey: "boss-polar-sector-v2",
    wreckKey: "boss-polar-sector-wreck-v2",
    partWidth: 56,
    partHeight: 24,
    muzzleY: 10,
    partLabel: "護甲環",
    support: false,
    halfWidth: 47,
    halfHeight: 47,
    partHalfWidth: 20,
    partHalfHeight: 10,
    entrySeconds: 2.6,
    restY: 190,
  },
};
export function bossRig(skin: BossSkin = "command") {
  return RIGS[skin];
}
const tau = Math.PI * 2;
const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
/** No player chase or random teleport: paths are continuous and reproducible. */
export function bossPose(
  skin: BossSkin = "command",
  age: number,
  phase: BossPhase = 1,
  phaseAge = age,
): BossPose {
  const rig = bossRig(skin),
    entered = age >= rig.entrySeconds,
    t = Math.max(0, age - rig.entrySeconds);
  let x = 180,
    y = rig.restY,
    roll = 0,
    ringAngle = 0,
    state = "approach",
    canFire = entered,
    fireWindow = 3600;
  if (skin === "command") {
    const frequency = phase === 1 ? 0.6 : phase === 2 ? 0.8 : tau / 7.2;
    x += Math.sin(t * frequency) * (phase === 1 ? 62 : 70);
    roll = -Math.cos(t * frequency) * 0.14;
    y += Math.sin(t * 1.2) * 6;
    state = phase === 1 ? "weave" : phase === 2 ? "strafe" : "windup";
    if (phase === 3) {
      const q = t % 7.2;
      y = 150;
      canFire = false;
      fireWindow = 0;
      if (q < 0.8) state = "windup";
      else if (q < 1.5) {
        state = "dive";
        y += 70 * ease((q - 0.8) / 0.7);
      } else if (q < 3.3) {
        state = "brake";
        y += 70;
        canFire = true;
        fireWindow = 3.3 - q;
        roll *= 0.3;
      } else if (q < 4.5) {
        state = "recover";
        y += 70 * (1 - ease((q - 3.3) / 1.2));
      } else {
        state = "strafe";
        canFire = true;
        fireWindow = 7.2 - q;
      }
    }
  } else if (skin === "riverFortress") {
    const q = t % 8;
    y += Math.sin((t * Math.PI) / 4) * 5;
    if (q < 1) {
      x = 138 + 84 * ease(q);
      state = "cross-channel";
      canFire = false;
      fireWindow = 0;
    } else if (q < 4) {
      x = 222;
      state = "starboard-salvo";
      fireWindow = 4 - q;
    } else if (q < 5) {
      x = 222 - 84 * ease(q - 4);
      state = "reverse-course";
      canFire = false;
      fireWindow = 0;
    } else {
      x = 138;
      state = "port-salvo";
      fireWindow = 8 - q;
    }
    roll = Math.sin((t * Math.PI) / 4) * (phase === 1 ? 0.06 : 0.1);
    if (phase === 3) y += Math.sin((t * Math.PI) / 4) ** 2 * 12;
  } else {
    const q = t % 3.6,
      cycle = Math.floor(t / 3.6);
    ringAngle = ((cycle + ease(q / 0.65)) * Math.PI) / 3;
    x += Math.sin(t * 0.45) * (phase === 3 ? 45 : 36);
    y += Math.sin(t * 0.65) * 6;
    roll = age * 0.25 + (phase === 3 ? phaseAge * 0.35 : 0);
    state = q < 0.65 ? "index-ring" : "locked-ring";
    canFire = q >= 0.65;
    fireWindow = canFire ? 3.6 - q : 0;
  }
  if (!entered) {
    const approach = ease(age / rig.entrySeconds);
    x = skin === "riverFortress" ? 180 - 42 * approach : 180;
    y = -60 + (rig.restY + 60) * approach;
    roll =
      skin === "command"
        ? -0.14 * approach
        : skin === "polarRadar"
          ? age * 0.25 * approach
          : 0;
    state = "approach";
    canFire = false;
    fireWindow = 0;
  }
  return { x, y, roll, ringAngle, state, entered, canFire, fireWindow };
}
export function rotateLocal(x: number, y: number, angle: number) {
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  };
}
export function bossMount(
  skin: BossSkin | undefined,
  index: number,
  pose: BossPose,
) {
  if (skin === "polarRadar") {
    const angle = pose.ringAngle + (index * Math.PI) / 2;
    return {
      x: pose.x + Math.sin(angle) * 70,
      y: pose.y + Math.cos(angle) * 70,
      angle,
      rotation: -angle,
    };
  }
  const offsets =
    skin === "riverFortress"
      ? [
          { x: -10, y: -43 },
          { x: 4, y: -10 },
          { x: -10, y: 22 },
        ]
      : [
          { x: -68, y: 20 },
          { x: 68, y: 20 },
        ];
  const local = offsets[index] ?? { x: 0, y: 0 },
    p = rotateLocal(local.x, local.y, pose.roll);
  return {
    x: pose.x + p.x,
    y: pose.y + p.y,
    angle: -pose.roll,
    rotation: pose.roll,
  };
}
/** Preserve old total armour / break damage / score despite different part counts. */
export function bossPartBudget(skin: BossSkin | undefined, oldSideHp: number) {
  const n = bossRig(skin).partCount,
    total = oldSideHp * 2;
  return Array.from({ length: n }, (_, i) => ({
    hp: Math.floor(total / n) + (i < total % n ? 1 : 0),
    breakDamage: 24 / n,
    points: Math.floor(500 / n) + (i < 500 % n ? 1 : 0),
  }));
}
export function bossBodyContains(
  boss: { skin?: BossSkin; x: number; y: number; roll?: number },
  x: number,
  y: number,
  padding = 0,
) {
  const r = bossRig(boss.skin),
    p = rotateLocal(x - boss.x, y - boss.y, -(boss.roll ?? 0));
  if (boss.skin === "command" || !boss.skin)
    return (
      Math.abs(p.x) < r.halfWidth + padding &&
      Math.abs(p.y) < r.halfHeight + padding
    );
  return (
    (p.x / (r.halfWidth + padding)) ** 2 +
      (p.y / (r.halfHeight + padding)) ** 2 <
    1
  );
}
export function bossPartContains(
  boss: { skin?: BossSkin },
  part: { x: number; y: number; rotation?: number },
  x: number,
  y: number,
  padding = 0,
) {
  const r = bossRig(boss.skin),
    p = rotateLocal(x - part.x, y - part.y, -(part.rotation ?? 0));
  return (
    Math.abs(p.x) < r.partHalfWidth + padding &&
    Math.abs(p.y) < r.partHalfHeight + padding
  );
}

/** A river ship's vulnerable bridge is aft of its three deck guns; the full
 * hull remains the contact footprint. This avoids bullets hitting hull HP
 * before they can ever reach an on-deck destructible gun. */
export function bossCorePoint(boss: {
  skin?: BossSkin;
  x: number;
  y: number;
  roll?: number;
}) {
  const p = rotateLocal(
    0,
    boss.skin === "riverFortress" ? -68 : 0,
    boss.roll ?? 0,
  );
  return { x: boss.x + p.x, y: boss.y + p.y };
}
export function bossCoreContains(
  boss: { skin?: BossSkin; x: number; y: number; roll?: number },
  x: number,
  y: number,
  padding = 0,
) {
  if (boss.skin !== "riverFortress")
    return bossBodyContains(boss, x, y, padding);
  const c = bossCorePoint(boss),
    p = rotateLocal(x - c.x, y - c.y, -(boss.roll ?? 0));
  return (p.x / (22 + padding)) ** 2 + (p.y / (18 + padding)) ** 2 < 1;
}
