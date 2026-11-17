/** Test-only keyboard pilot. No future waves, health writes or model access. */
export type Steering = -1 | 0 | 1;
export interface PilotSnapshot {
  player: { x: number; y: number };
  hostileProjectiles: ReadonlyArray<{
    x: number;
    y: number;
    vx: number;
    vy: number;
  }>;
  width?: number;
  height?: number;
}
const horizon = 0.35;
const speed = 240;
/** Minimum separation along actual relative trajectories, including wall stop. */
export function clearance(s: PilotSnapshot, dx: Steering): number {
  const width = s.width ?? 360;
  const p = s.player;
  const stop =
    dx === 0
      ? horizon
      : Math.min(
          horizon,
          Math.max(0, (dx < 0 ? p.x - 18 : width - 18 - p.x) / speed),
        );
  let minimum = Infinity;
  for (const b of s.hostileProjectiles) {
    if (b.x < 0 || b.x > width || b.y < 0 || b.y > (s.height ?? 640)) continue;
    for (const [start, end, velocity] of [
      [0, stop, speed * dx],
      [stop, horizon, 0],
    ]) {
      if (end <= start) continue;
      const rx =
        b.x + b.vx * start - (p.x + speed * dx * Math.min(start, stop));
      const ry = b.y + b.vy * start - p.y;
      const vx = b.vx - velocity;
      const vv = vx * vx + b.vy * b.vy;
      const t = vv
        ? Math.max(0, Math.min(end - start, -(rx * vx + ry * b.vy) / vv))
        : 0;
      minimum = Math.min(minimum, Math.hypot(rx + vx * t, ry + b.vy * t));
    }
  }
  return minimum;
}
export function chooseAction(
  s: PilotSnapshot,
  currentKey: Steering = 0,
): Steering {
  const width = s.width ?? 360;
  const actions: Steering[] = [0, -1, 1];
  const allowed = actions.filter(
    (d) => !(d < 0 && s.player.x <= 22) && !(d > 0 && s.player.x >= width - 22),
  );
  const distance = new Map(allowed.map((d) => [d, clearance(s, d)]));
  // Centering is optional, never a reason to cross a bullet's swept path.
  const toward = Math.sign(width / 2 - s.player.x) as Steering;
  if (distance.get(0)! >= 32) {
    if (
      Math.abs(width / 2 - s.player.x) > 48 &&
      (distance.get(toward) ?? 0) >= 48
    )
      return toward;
    return 0;
  }
  let best: Steering = 0;
  let score = -Infinity;
  for (const action of allowed) {
    // Cap distant clearances so remote projectiles do not pull the pilot around.
    const value =
      Math.min(60, distance.get(action)!) +
      (action === currentKey ? 4 : 0) +
      (action === 0 ? 1 : 0);
    if (value > score) {
      score = value;
      best = action;
    }
  }
  return best;
}
