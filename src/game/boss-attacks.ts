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
/** Clamp the cone centre, never individual rays (which would merge at an edge). */
function fanAngles(centre: number, offsets: number[]) {
  const safe = Math.max(
    -1.1 - Math.min(...offsets),
    Math.min(1.1 - Math.max(...offsets), centre),
  );
  return offsets.map((offset) => safe + offset);
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
    const lead = active[boss.attackCycle % Math.max(1, active.length)];
    for (const i of active) {
      // One marked deck gun baits the player; escorts cover a fixed side lane.
      // Breaking a gun removes its complete role, not only a cosmetic barrel.
      const a =
        phase === 1 || i === lead
          ? aim(i)
          : boss.attackCycle % 2
            ? -0.28
            : 0.28;
      const offsets =
        phase === 1
          ? [0, 0]
          : phase === 2
            ? [boss.attackCycle % 2 ? -0.28 : 0.28, 0]
            : i === 2
              ? [-0.46, -0.2, 0.2, 0.46]
              : i === lead
                ? [-0.16, 0.16]
                : [-0.02, 0.02];
      for (const [j, angle] of fanAngles(a, offsets).entries())
        add(
          i,
          angle,
          i * 0.06,
          j < offsets.length / 2 ? -3 : 3,
          phase > 1 && i === lead ? "rocket" : "shell",
        );
    }
    if (!active.length) {
      const offsets =
        phase === 1
          ? [-0.12, 0.12]
          : phase === 2
            ? boss.attackCycle % 2
              ? [-0.34, -0.1]
              : [0.1, 0.34]
            : [-0.46, -0.23, 0, 0.23, 0.46];
      for (const [i, angle] of fanAngles(aim(null), offsets).entries())
        add(
          null,
          angle,
          phase === 2 ? i * 0.08 : 0,
          i % 2 ? -1.5 : 1.5,
          "rocket",
        );
    }
  } else if (boss.skin === "polarRadar") {
    if (phase === 1) {
      const down = active.filter(
        (i) => Math.cos(boss.cannons[i].aimAngle ?? 0) > 0.1,
      );
      for (const i of down)
        for (const offset of [-0.12, 0.12])
          add(i, (boss.cannons[i].aimAngle ?? 0) + offset, (i % 2) * 0.04);
    } else if (phase === 2) {
      for (const i of active) add(i, boss.cannons[i].aimAngle ?? 0, 0.13);
      add(null, aim(null), 0.02);
    } else {
      // Bait needle first, then a delayed split fan. The central opening in
      // the plasma wall rewards moving after the aimed rocket is committed.
      const target = aim(null);
      if (boss.attackCycle % 2 === 0) {
        const angles = fanAngles(target, [-0.6, -0.3, 0, 0.3, 0.6]);
        add(null, angles[2], 0, 0, "rocket");
        for (const i of [0, 1, 3, 4]) add(null, angles[i], 0.11);
      } else {
        // Counter-pattern: put the rockets on the edges of a narrow gate.
        // An early plasma shot holds the middle only briefly, then the
        // centre reopens. Do not chase the player after charging.
        const angles = fanAngles(target, [-0.52, -0.24, 0, 0.24, 0.52]);
        add(null, angles[2]);
        add(null, angles[0]);
        add(null, angles[4]);
        add(null, angles[1], 0.11, -12, "rocket");
        add(null, angles[3], 0.11, 12, "rocket");
      }
      for (const i of active) add(i, boss.cannons[i].aimAngle ?? 0, 0.11);
    }
    if (!rays.length)
      for (const a of fanAngles(aim(null), [-0.3, 0, 0.3])) add(null, a);
  } else if (boss.skin === "ascentGate" || boss.skin === "orbitalLattice") {
    const orbital = boss.skin === "orbitalLattice";
    for (const i of active)
      for (const a of fanAngles(
        aim(i),
        orbital ? [-0.22, 0.22] : [-0.16, 0.16],
      ))
        add(i, a, i * 0.09, 0, "rocket");
    const split = (orbital && boss.attackCycle % 2) || phase === 3;
    for (const [i, a] of fanAngles(
      split ? 0 : aim(null),
      split ? [-0.72, -0.39, 0.39, 0.72] : [-0.3, 0, 0.3],
    ).entries())
      add(null, a, i * 0.08, 0, "plasma");
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
    const centre = phase === 3 ? aim(null) : boss.attackCycle % 2 ? 0.1 : -0.1;
    for (const [i, a] of fanAngles(centre, offsets).entries())
      add(null, a, 0, 0, phase === 3 && i === 1 ? "rocket" : "plasma");
  }
  return rays;
}
export function bossCadence(boss: Boss, base: number) {
  const multipliers =
    boss.skin === "riverFortress"
      ? [1, 0.9, 0.7]
      : boss.skin === "polarRadar"
        ? [1, 0.9, 0.7]
        : [1, 1, 0.7];
  return base * multipliers[boss.phase - 1];
}
