import type { Boss } from "./model";
import { bossSideTargets } from "./boss-muzzles";
import type { HostileStyle } from "./hostile-visuals";
export interface BossRay {
  mount: number | null;
  angle: number;
  delay: number;
  lateral: number;
  style: HostileStyle;
  target?: { x: number; y: number };
}
const clamp = (n: number) => Math.max(-1.1, Math.min(1.1, n));
/** Plan once during a local charge. Delayed pulses recompute the LIVE muzzle,
 * retain this warned direction and cancel with their destroyed mount. */
export function bossAttackPlan(
  boss: Boss,
  player: { x: number; y: number },
): BossRay[] {
  const rays: BossRay[] = [],
    phase = boss.phase,
    active = boss.cannons
      .map((p, i) => (p.active ? i : -1))
      .filter((i) => i >= 0);
  const add = (
    mount: number | null,
    angle: number,
    delay = 0,
    lateral = 0,
    style: HostileStyle = "plasma",
  ) => rays.push({ mount, angle, delay, lateral, style });
  const aim = (i: number | null) => {
    const p = i === null ? boss : boss.cannons[i];
    return clamp(Math.atan2(player.x - p.x, player.y - p.y));
  };
  if (boss.skin === "riverFortress") {
    for (const i of active) {
      const a = aim(i);
      const offsets =
        phase === 1
          ? [0, 0]
          : phase === 2
            ? [boss.attackCycle % 2 ? -0.28 : 0.28, 0]
            : i === 2
              ? [-0.46, -0.2, 0.2, 0.46]
              : [-0.02, 0.02];
      for (const [j, offset] of offsets.entries())
        add(
          i,
          clamp(a + offset),
          i * 0.06,
          j < offsets.length / 2 ? -3 : 3,
          "shell",
        );
    }
    if (!active.length)
      for (const [i, a] of [-0.12, 0.12].entries())
        add(null, clamp(aim(null) + a), 0, i === 0 ? -4 : 4, "rocket");
  } else if (boss.skin === "polarRadar") {
    if (phase === 1) {
      const down = active.filter(
        (i) => Math.cos(boss.cannons[i].aimAngle ?? 0) > 0.1,
      );
      for (const i of down)
        for (const offset of [-0.12, 0.12])
          add(i, (boss.cannons[i].aimAngle ?? 0) + offset, (i % 2) * 0.04);
    } else if (phase === 2) {
      for (const i of active) add(i, boss.cannons[i].aimAngle ?? 0, i * 0.04);
      add(null, aim(null), 0.08);
    } else {
      for (const a of [-0.5, -0.25, 0, 0.25, 0.5])
        add(null, clamp(aim(null) + a));
      for (const i of active) add(i, boss.cannons[i].aimAngle ?? 0, i * 0.04);
    }
    if (!rays.length)
      for (const a of [-0.3, 0, 0.3]) add(null, clamp(aim(null) + a));
  } else if (phase === 1 && active.length) {
    const target = bossSideTargets(player.x, player.y, boss.attackCycle);
    for (const i of active) {
      const p = boss.cannons[i];
      add(i, Math.atan2(target.xs[i] - p.x, target.y - p.y));
      rays[rays.length - 1].target = { x: target.xs[i], y: target.y };
    }
  } else {
    const offsets =
      phase === 1
        ? [-0.3, 0, 0.3]
        : phase === 2
          ? [-0.5, -0.25, 0, 0.25, 0.5]
          : [-0.3, 0, 0.3];
    for (const a of offsets)
      add(
        null,
        clamp(
          a + (phase === 3 ? aim(null) : boss.attackCycle % 2 ? 0.1 : -0.1),
        ),
      );
  }
  return rays;
}
export function bossCadence(boss: Boss, base: number) {
  const multipliers =
    boss.skin === "riverFortress"
      ? [1, 0.9, 0.7]
      : boss.skin === "polarRadar"
        ? [1, 0.9, 0.8]
        : [1, 1, 0.7];
  return base * multipliers[boss.phase - 1];
}
