import type { Behavior } from "../data/stage";
/** Role classification shared by collision, scroll, rendering and observation. */
export function isGroundRole(role?: string): boolean {
  return (
    role === "groundBattery" ||
    role === "groundDepot" ||
    role === "missileTruck" ||
    role === "flakBattery"
  );
}
export function isNewAirRole(role?: Behavior): role is "outrider" | "bomber" {
  return role === "outrider" || role === "bomber";
}
export const NEW_ENEMY_ART = {
  outrider: { key: "enemy-outrider", width: 56, height: 44, muzzleY: 20 },
  bomber: { key: "enemy-bomber", width: 88, height: 54, muzzleY: 25 },
} as const;
