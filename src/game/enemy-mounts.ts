import { fastAttackAngles } from "./enemy-patterns";
import type { Enemy } from "./model";
type MountBody = Pick<
  Enemy,
  | "x"
  | "y"
  | "behavior"
  | "direction"
  | "diveAngle"
  | "age"
  | "attackAngles"
  | "shotsFired"
>;
/** Shooting craft strafe upright; only the non-shooting dive/carrier hull turns. */
export function enemyBank(
  e: Pick<Enemy, "behavior" | "direction" | "diveAngle" | "age">,
) {
  return e.behavior === "carrier"
    ? -(e.direction ?? 1) * 90
    : e.behavior === "dive"
      ? (-(e.diveAngle ?? 0) * 180) / Math.PI
      : 0;
}
/** Shared presentation sockets mirror the existing projectile launch geometry. */
export function enemyMount(e: MountBody, index = 0) {
  if (e.behavior === "bomber") return { x: e.x, y: e.y + 25 };
  if (e.behavior === "gatekeeper")
    return { x: e.x + (index % 2 ? -39 : 39), y: e.y + 32 };
  if (e.behavior === "brakeRaider" || e.behavior === "hookWing")
    return { x: e.x + (index % 2 ? 9 : -9), y: e.y + 20 };
  if (["straight", "weave", "cross"].includes(e.behavior ?? "")) {
    const angles = e.attackAngles?.length
      ? e.attackAngles
      : fastAttackAngles(e.behavior, e.shotsFired ?? 0, e.direction);
    const angle = angles[index % angles.length],
      side = index % 2 ? 9 : -9;
    return {
      x: e.x + Math.cos(angle) * side,
      y: e.y + 20 - Math.sin(angle) * side,
    };
  }
  return { x: e.x, y: e.y + 20 };
}
