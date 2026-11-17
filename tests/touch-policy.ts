import {
  clearance,
  type PilotSnapshot,
  type Steering,
} from "./keyboard-policy";
/** Test pilot only: touch targets stop at their destination, unlike held keys. */
export function touchClearance(
  s: PilotSnapshot,
  targetX: number,
  predictionSeconds = 0.35,
): number {
  const x = Math.max(18, Math.min((s.width ?? 360) - 18, targetX));
  return clearance(
    s,
    Math.sign(x - s.player.x) as Steering,
    Math.abs(x - s.player.x),
    predictionSeconds,
  );
}
/** Evaluate both immediate delivery and a bounded delayed command. Until the
 * new target arrives, the player continues toward the PREVIOUS touch target. */
export function delayedTouchClearance(
  s: PilotSnapshot,
  target: number,
  previousTarget: number,
  latencySeconds = 0.2,
): number {
  let result = touchClearance(s, target, 0.55);
  const delay = Math.max(0, Math.min(0.3, latencySeconds));
  for (const lag of [delay / 2, delay]) {
    const oldX = Math.max(18, Math.min((s.width ?? 360) - 18, previousTarget));
    const delta = oldX - s.player.x;
    const x =
      s.player.x + Math.sign(delta) * Math.min(Math.abs(delta), 240 * lag);
    const future = {
      ...s,
      player: { x, y: s.player.y },
      hostileProjectiles: s.hostileProjectiles.map((b) => ({
        ...b,
        x: b.x + b.vx * lag,
        y: b.y + b.vy * lag,
      })),
    };
    result = Math.min(
      result,
      touchClearance(s, oldX, lag),
      touchClearance(future, target, 0.55 - lag),
    );
  }
  return result;
}
export function chooseTouchTarget(
  s: PilotSnapshot,
  previousTarget = s.player.x,
  latencySeconds = 0.2,
): number {
  const width = s.width ?? 360,
    x = s.player.x;
  const clamp = (v: number) => Math.max(18, Math.min(width - 18, v));
  const center = clamp(x + Math.max(-72, Math.min(72, width / 2 - x)));
  const safe = (target: number) =>
    delayedTouchClearance(s, target, previousTarget, latencySeconds);
  const stay = safe(x);
  if (stay >= 32) {
    return Math.abs(width / 2 - x) > 48 && safe(center) >= 48 ? center : x;
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
      Math.min(60, safe(target)) +
      (Math.abs(target - previousTarget) < 1 ? 4 : 0) -
      Math.abs(target - x) * 0.015;
    if (value > score) {
      best = target;
      score = value;
    }
  }
  return best;
}
