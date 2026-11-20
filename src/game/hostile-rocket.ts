import type Phaser from "phaser";
import type { EnemyBullet } from "./model";
export const ROCKET_ART = {
  key: "hostile-missile-v2",
  width: 11,
  height: 26,
  nozzle: 12,
} as const;
type Point = { x: number; y: number };
export interface RocketPose {
  angle: number;
  nozzle: Point;
  outer: [Point, Point, Point];
  inner: [Point, Point, Point];
}
export function createRocketPose(): RocketPose {
  return {
    angle: 0,
    nozzle: { x: 0, y: 0 },
    outer: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    inner: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  };
}
/** Actual velocity only. The live renderer supplies one reusable scratch pose:
 * no arrays, point objects or closures are allocated per missile per frame. */
export function rocketPresentation(
  shot: Pick<EnemyBullet, "x" | "y" | "vx" | "vy" | "id">,
  time: number,
  pose: RocketPose = createRocketPose(),
): RocketPose {
  const speed = Math.hypot(shot.vx, shot.vy),
    dx = speed ? shot.vx / speed : 0,
    dy = speed ? shot.vy / speed : 1;
  pose.angle = (-Math.atan2(dx, dy) * 180) / Math.PI;
  pose.nozzle.x = shot.x - dx * ROCKET_ART.nozzle;
  pose.nozzle.y = shot.y - dy * ROCKET_ART.nozzle;
  const length = 7 + (Math.sin(time * 47 + shot.id) * 0.5 + 0.5) * 5;
  for (let i = 0; i < 3; i++) {
    const along = i === 2 ? -length : 0;
    const side = i === 0 ? -2.8 : i === 1 ? 2.8 : 0;
    pose.outer[i].x = pose.nozzle.x + dx * along + dy * side;
    pose.outer[i].y = pose.nozzle.y + dy * along - dx * side;
    pose.inner[i].x = pose.nozzle.x + dx * along * 0.7 + dy * side * 0.4;
    pose.inner[i].y = pose.nozzle.y + dy * along * 0.7 - dx * side * 0.4;
  }
  return pose;
}
export function drawRocketExhaust(
  g: Phaser.GameObjects.Graphics,
  pose: RocketPose,
) {
  const o = pose.outer,
    i = pose.inner;
  g.fillStyle(0xff974a, 0.9).fillTriangle(
    o[0].x,
    o[0].y,
    o[1].x,
    o[1].y,
    o[2].x,
    o[2].y,
  );
  g.fillStyle(0xfff1bc, 1).fillTriangle(
    i[0].x,
    i[0].y,
    i[1].x,
    i[1].y,
    i[2].x,
    i[2].y,
  );
}
