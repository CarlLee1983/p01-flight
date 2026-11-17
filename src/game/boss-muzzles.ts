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
