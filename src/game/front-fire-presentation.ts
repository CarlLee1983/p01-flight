import type Phaser from "phaser";
import { sustainedX, type SustainedRay } from "./sustained-fire";
export function drawSustainedFire(
  rays: SustainedRay[],
  g: Phaser.GameObjects.Graphics,
) {
  for (const ray of rays) {
    const color = ray.kind === "lance" ? 0xffaa58 : 0xa0fcff,
      destination = sustainedX(ray, 640);
    if (ray.state === "charge") {
      g.fillStyle(color, 0.7 + 0.3 * ray.progress).fillCircle(
        ray.x,
        ray.y,
        5 + 4 * ray.progress,
      );
      const end = sustainedX(ray, 624);
      if (end >= 0 && end <= 360)
        g.fillStyle(color, 0.65 + 0.35 * ray.progress).fillRoundedRect(
          end - ray.width - 3,
          622,
          (ray.width + 3) * 2,
          5,
          2,
        );
      continue;
    }
    for (const [pad, c, a] of [
      [8, color, 0.23],
      [0, color, 0.85],
      [-ray.width * 0.63, 0xfffaf3, 0.9],
    ]) {
      const w = ray.width + pad;
      g.fillStyle(c, a)
        .beginPath()
        .moveTo(ray.x - w, ray.y)
        .lineTo(ray.x + w, ray.y)
        .lineTo(destination + w, 640)
        .lineTo(destination - w, 640)
        .closePath()
        .fillPath();
    }
    g.fillStyle(0xfff4ce, 0.88).fillCircle(ray.x, ray.y, ray.width + 2);
  }
}
