import {
  clearance,
  type PilotSnapshot,
  type Steering,
} from "./keyboard-policy";
/** Test pilot only: touch targets stop at their destination, unlike held keys. */
export function touchClearance(s: PilotSnapshot, targetX: number): number {
  const x = Math.max(18, Math.min((s.width ?? 360) - 18, targetX));
  return clearance(
    s,
    Math.sign(x - s.player.x) as Steering,
    Math.abs(x - s.player.x),
  );
}
export function chooseTouchTarget(
  s: PilotSnapshot,
  previousTarget = s.player.x,
): number {
  const width = s.width ?? 360,
    x = s.player.x;
  const clamp = (v: number) => Math.max(18, Math.min(width - 18, v));
  const center = clamp(x + Math.max(-72, Math.min(72, width / 2 - x)));
  const stay = touchClearance(s, x);
  if (stay >= 32) {
    return Math.abs(width / 2 - x) > 48 && touchClearance(s, center) >= 48
      ? center
      : x;
  }
  const candidates = [
    ...new Set(
      [x, previousTarget, x - 24, x + 24, x - 48, x + 48, x - 72, x + 72].map(
        clamp,
      ),
    ),
  ];
  let best = x,
    score = -Infinity;
  for (const target of candidates) {
    const value =
      Math.min(60, touchClearance(s, target)) +
      (Math.abs(target - previousTarget) < 1 ? 4 : 0) -
      Math.abs(target - x) * 0.015;
    if (value > score) {
      best = target;
      score = value;
    }
  }
  return best;
}
