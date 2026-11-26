import type { FlightModel } from "../src/game/model";
/** Test pilot uses only visible projectiles and normal steering, no state edits.
 * A denser/less overlapping pattern needs a real dodge rather than a magic timestamp. */
export function dodgeDirection(m: FlightModel, fallback: number): number {
  const incoming = m.enemyBullets.filter(
    (b) =>
      b.active && b.vy > 0 && b.y < m.player.y + 12 && b.y > m.player.y - 100,
  );
  const danger = (x: number) =>
    incoming.reduce((sum, b) => {
      const t = Math.max(0, (m.player.y - b.y) / b.vy);
      const distance = Math.abs(b.x + b.vx * t - x);
      return sum + Math.max(0, 32 - distance) / (0.3 + t);
    }, 0);
  const stay = danger(m.player.x);
  if (!stay)
    return (
      fallback ||
      (Math.abs(
        m.player.x -
          (m.boss?.active &&
          ((m.boss.skin !== "command" && m.boss.skin !== undefined) ||
            m.bombs === 0)
            ? m.boss.x
            : 180),
      ) > 10
        ? Math.sign(
            (m.boss?.active &&
            ((m.boss.skin !== "command" && m.boss.skin !== undefined) ||
              m.bombs === 0)
              ? m.boss.x
              : 180) - m.player.x,
          )
        : 0)
    );
  const left = m.player.x > 55 ? danger(m.player.x - 36) : Infinity;
  const right =
    m.player.x < m.stage.width - 55 ? danger(m.player.x + 36) : Infinity;
  if (left < stay || right < stay) return left < right ? -1 : 1;
  return fallback;
}
