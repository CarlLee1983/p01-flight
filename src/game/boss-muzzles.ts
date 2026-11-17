import type { Boss } from "./model";

/** One source of truth for forecast, firing and broken-part suppression. */
export function bossMuzzle(boss: Boss, rayIndex: number, rayCount: number) {
  const side = rayIndex === 0 ? -1 : rayIndex === rayCount - 1 ? 1 : 0;
  const cannon = boss.cannons.find((part) => part.side === side);
  return {
    x: cannon ? cannon.x : boss.x,
    y: cannon ? cannon.y + 22 : boss.y + 28,
    active: cannon?.active ?? true,
    cannon,
  };
}

/** Phase-one lock: one lane threatens the old player position, the other fences
 * its side. Clamp the gap, not each endpoint, so its 96px width never collapses. */
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
    const muzzle = bossMuzzle(boss, index, 2);
    return Math.atan2(x - muzzle.x, target.y - muzzle.y);
  });
}
