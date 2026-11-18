import type { Enemy } from "./model";
import type { Behavior } from "../data/stage";
export type HostileStyle = "needle" | "shell" | "plasma" | "rocket";
export function hostileStyle(boss: boolean, behavior?: Behavior): HostileStyle {
  return boss
    ? "plasma"
    : behavior === "missileTruck"
      ? "rocket"
      : behavior === "flakBattery" || behavior === "bomber" || behavior === "groundBattery" ||
        behavior === "turret" ||
        behavior === "heavy"
      ? "shell"
      : "needle";
}
/** Same locked axis for turret drawing, warning and projectile spawn. */
export function groundMuzzle(enemy: Pick<Enemy, "x" | "y">, angle: number, side = 0) {
  return {
    x: enemy.x + Math.sin(angle) * 20 + Math.cos(angle) * side,
    y: enemy.y + Math.cos(angle) * 20 - Math.sin(angle) * side,
  };
}
export function turnToward(current: number, target: number, dt: number) {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + Math.max(-dt * 3, Math.min(dt * 3, delta));
}
/** Settled hull stays below the 72px HUD even at maximum bank. */
export const BOSS_BODY = { width: 120, height: 62, bankDegrees: 1 } as const;
