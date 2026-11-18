import type Phaser from "phaser";
import type { Boss } from "./model";
import { bossRig, bossCorePoint } from "./boss-rigs";
import { bossChargeSources } from "./combat-presentation";
type Sprite = (
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha?: number,
  angle?: number,
  body?: Boss | Boss["cannons"][number],
) => Phaser.GameObjects.Image;
/** Live renderer and visual rehearsal use the same assets, pivots and damage state. */
export function drawBoss(
  boss: Boss,
  sprite: Sprite,
  overlay: Phaser.GameObjects.Graphics,
  time: number,
) {
  const rig = bossRig(boss.skin),
    degrees = 180 / Math.PI;
  if (rig.support)
    sprite(
      "boss-support",
      boss.x,
      boss.y,
      184,
      100,
      1,
      (boss.roll ?? 0) * degrees,
    ).setDepth(0.8);
  sprite(
    rig.key,
    boss.x,
    boss.y,
    rig.width,
    rig.height,
    1,
    (boss.roll ?? 0) * degrees,
    boss,
  );
  for (const part of boss.cannons) {
    sprite(
      part.active ? rig.partKey : rig.wreckKey,
      part.x,
      part.y,
      rig.partWidth,
      rig.partHeight,
      1,
      (part.rotation ?? 0) * degrees,
      part,
    ).setDepth(2);
    if (part.active) {
      const y = part.y - rig.partHeight / 2 - 4;
      overlay.fillStyle(0x182630).fillRect(part.x - 10, y, 20, 2);
      overlay
        .fillStyle(0xffc779)
        .fillRect(part.x - 10, y, (20 * part.hp) / part.maxHp, 2);
    } else
      overlay
        .fillStyle(0xe28c59, 0.45 + Math.sin(time * 9) * 0.15)
        .fillCircle(part.x, part.y, 1.5);
  }
  // Only local charge glints, never a future projectile trajectory.
  if (boss.attackWarning > 0)
    for (const p of bossChargeSources(boss)) {
      overlay.fillStyle(0xffd179, 0.85).fillCircle(p.x, p.y, 3);
      overlay
        .lineStyle(1.5, 0xffd179, 0.9)
        .lineBetween(p.x - 6, p.y + 2, p.x - 3, p.y + 6)
        .lineBetween(p.x + 6, p.y + 2, p.x + 3, p.y + 6);
    }
  const core = bossCorePoint(boss);
  overlay
    .fillStyle(boss.phase === 3 ? 0xff805a : 0xffbf73, 0.55)
    .fillCircle(core.x, core.y, 2 + Math.sin(time * 12));
  if (boss.telegraph > 0) {
    overlay.lineStyle(2, 0xffd179, 0.85);
    const span = Math.max(
      rig.width / 2 + 12,
      boss.skin === "polarRadar" ? 104 : 0,
    );
    for (const side of [-1, 1]) {
      const x = boss.x + side * span;
      overlay
        .lineBetween(x, boss.y - 18, x, boss.y + 12)
        .lineBetween(x, boss.y - 18, x - side * 8, boss.y - 18);
    }
  }
}
