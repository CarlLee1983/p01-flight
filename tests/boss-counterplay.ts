/** Test pilot reads the same currently visible armour positions/counter as HUD.
 * No future pose, wave time, immunity or hidden target selection. */
export function bossAimGoal(
  boss:
    | {
        active: boolean;
        skin?: string;
        phase?: number;
        x: number;
        y: number;
        cannons: { active: boolean; x: number; y: number }[];
      }
    | null
    | undefined,
  playerX: number,
) {
  if (!boss?.active) return undefined;
  const active = boss.cannons.filter((p) => p.active);
  const limit = (boss.phase ?? 1) === 1 ? 2 : boss.phase === 2 ? 1 : 0;
  if (boss.skin === "polarRadar" && active.length > limit) {
    const reachable = active.filter(
      (p) => p.y > boss.y + 10 && p.x >= 18 && p.x <= 342,
    );
    reachable.sort(
      (a, b) => Math.abs(a.x - playerX) - Math.abs(b.x - playerX) || b.y - a.y,
    );
    if (reachable.length) return reachable[0].x;
    const flank = active
      .filter((p) => Math.abs(p.x - boss.x) > 55 && p.x >= 18 && p.x <= 342)
      .sort((a, b) => Math.abs(a.x - playerX) - Math.abs(b.x - playerX));
    return flank[0]?.x ?? boss.x;
  }
  return boss.x;
}
