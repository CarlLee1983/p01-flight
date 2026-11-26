import type { Boss } from "./model";
import type { BossRay } from "./boss-attacks";
import { bossRig, rotateLocal, bossBowMount, RIVER_BOW_ART } from "./boss-rigs";
/** Physical origin shared by live pulses, charge marks and geometry checks. */
export function bossShotOrigin(
  boss: Boss,
  ray: Pick<BossRay, "mount" | "lateral">,
) {
  const part = ray.mount === null ? undefined : boss.cannons[ray.mount];
  if (part) {
    const a = part.aimAngle ?? 0,
      y = bossRig(boss.skin).muzzleY;
    return {
      x: part.x + Math.sin(a) * y + Math.cos(a) * ray.lateral,
      y: part.y + Math.cos(a) * y - Math.sin(a) * ray.lateral,
      active: part.active,
      cannon: part,
    };
  }
  if (boss.skin === "riverFortress") {
    const mount = bossBowMount(boss),
      a = mount.angle;
    return {
      x:
        mount.x +
        Math.sin(a) * RIVER_BOW_ART.muzzleY +
        Math.cos(a) * ray.lateral,
      y:
        mount.y +
        Math.cos(a) * RIVER_BOW_ART.muzzleY -
        Math.sin(a) * ray.lateral,
      active: true,
      cannon: undefined,
    };
  }
  const local =
    boss.skin === "polarRadar"
      ? rotateLocal(ray.lateral, 0, boss.roll ?? 0)
      : rotateLocal(ray.lateral, 28, boss.roll ?? 0);
  return {
    x: boss.x + local.x,
    y: boss.y + local.y,
    active: true,
    cannon: undefined,
  };
}
export function bossMuzzle(boss: Boss, rayIndex: number, rayCount: number) {
  const planned = boss.attackPlan?.[rayIndex];
  if (planned) return bossShotOrigin(boss, planned);
  const side = rayIndex === 0 ? -1 : rayIndex === rayCount - 1 ? 1 : 0;
  const index = boss.cannons.findIndex((p) => p.side === side);
  return bossShotOrigin(boss, { mount: index < 0 ? null : index, lateral: 0 });
}
/** Keep the original first-boss 96px target gap; lock to observed position. */
export function bossSideTargets(
  playerX: number,
  playerY: number,
  cycle: number,
) {
  const gapX = Math.max(76, Math.min(284, playerX + (cycle % 2 ? -48 : 48)));
  return {
    xs: [gapX - 48, gapX + 48],
    y: Math.max(420, Math.min(570, playerY)),
    gapX,
  };
}
export function bossSideAngles(boss: Boss, playerX: number, playerY: number) {
  const target = bossSideTargets(playerX, playerY, boss.attackCycle);
  return target.xs.map((x, index) => {
    const part = boss.cannons[index];
    const p = part ?? boss;
    return Math.atan2(x - p.x, target.y - p.y);
  });
}

/** Lock the warned world target while resolving each pulse at its live barrel. */
export function resolveBossRay(boss: Boss, ray: BossRay) {
  const origin = bossShotOrigin(boss, ray);
  const angle = ray.target
    ? Math.atan2(ray.target.x - origin.x, ray.target.y - origin.y)
    : ray.angle;
  return { ...origin, angle };
}
