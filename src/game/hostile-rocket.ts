import type Phaser from "phaser";
import type { EnemyBullet } from "./model";
export const ROCKET_ART = {
  key: "hostile-missile-v2",
  width: 8,
  height: 18,
} as const;
/** Body follows actual velocity; all exhaust vertices remain behind it. */
export function rocketPresentation(
  shot: Pick<EnemyBullet, "x" | "y" | "vx" | "vy" | "id">,
  time: number,
) {
  const speed = Math.hypot(shot.vx, shot.vy),
    dx = speed ? shot.vx / speed : 0,
    dy = speed ? shot.vy / speed : 1;
  const nozzle = { x: shot.x - dx * 8, y: shot.y - dy * 8 };
  const length = 5 + (Math.sin(time * 47 + shot.id) * 0.5 + 0.5) * 4;
  const point = (along: number, side: number) => ({
    x: nozzle.x + dx * along + dy * side,
    y: nozzle.y + dy * along - dx * side,
  });
  return {
    angle: (-Math.atan2(dx, dy) * 180) / Math.PI,
    nozzle,
    outer: [point(0, -2), point(0, 2), point(-length, 0)],
    inner: [point(0, -0.85), point(0, 0.85), point(-length * 0.7, 0)],
  };
}
export function drawRocketExhaust(
  g: Phaser.GameObjects.Graphics,
  pose: ReturnType<typeof rocketPresentation>,
) {
  const draw = (
    points: { x: number; y: number }[],
    color: number,
    alpha: number,
  ) =>
    g
      .fillStyle(color, alpha)
      .fillTriangle(
        points[0].x,
        points[0].y,
        points[1].x,
        points[1].y,
        points[2].x,
        points[2].y,
      );
  draw(pose.outer, 0xff974a, 0.8);
  draw(pose.inner, 0xfff1bc, 0.95);
}
