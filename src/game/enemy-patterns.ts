import type { Behavior } from "../data/stage";

/** Locked angles in radians clockwise from down. Fast craft fire two diverging
 * muzzles at once: moving a muzzle faster than its bullets creates overlaps. */
export function fastAttackAngles(
  behavior: Behavior | undefined,
  volley: number,
  direction = 1,
): number[] {
  if (behavior === "hookWing") {
    const lean = direction * (volley % 2 ? -0.32 : 0.32);
    return [lean - 0.13, lean + 0.13];
  }
  if (behavior === "weave") {
    const lean = volley % 2 ? 0.22 : -0.22;
    return [lean - 0.14, lean + 0.14];
  }
  if (behavior === "cross")
    return [direction * 0.35 - 0.14, direction * 0.35 + 0.14];
  return [-0.18, 0.18];
}
export function isFastShooter(behavior: Behavior | undefined): boolean {
  return (
    behavior === "straight" ||
    behavior === "weave" ||
    behavior === "cross" ||
    behavior === "brakeRaider" ||
    behavior === "hookWing"
  );
}
