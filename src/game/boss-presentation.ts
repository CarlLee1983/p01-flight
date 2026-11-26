import type Phaser from "phaser";
import type { Boss } from "./model";
import {
  bossRig,
  bossCoreState,
  bossCorePoint,
  bossBowMount,
  RIVER_BOW_ART,
} from "./boss-rigs";
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
  if (boss.skin === "polarRadar") {
    // The arms attach to live generator pivots. Breaking a generator leaves
    // a short broken arm rather than a full-length working linkage.
    for (const part of boss.cannons) {
      const dx = part.x - boss.x,
        dy = part.y - boss.y;
      const length = Math.hypot(dx, dy);
      const extension = part.active ? 1 : 0.58;
      sprite(
        "boss-polar-hinge",
        boss.x + (dx * extension) / 2,
        boss.y + (dy * extension) / 2,
        length * extension,
        14,
        part.active ? 1 : 0.65,
        Math.atan2(dy, dx) * degrees,
      ).setDepth(0.9);
    }
    const state = bossCoreState(boss);
    sprite(
      "boss-polar-rotor-v2",
      boss.x,
      boss.y,
      64,
      64,
      state === "open" ? 1 : 0.72,
      time * 22 + Math.sin(time * 3) * 8,
      boss,
    ).setDepth(1.5);
  }
  if (boss.skin === "riverFortress") {
    const bow = bossBowMount(boss);
    sprite(
      rig.partKey,
      bow.x,
      bow.y,
      RIVER_BOW_ART.width,
      RIVER_BOW_ART.height,
      1,
      -bow.angle * degrees,
      boss,
    ).setDepth(2);
  }
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
  if (bossCoreState(boss) !== "open") {
    const flash = (boss.shieldHitUntil ?? 0) > time;
    overlay
      .lineStyle(
        flash ? 2 : 1,
        flash ? 0xffffff : 0x8ee2ed,
        flash ? 0.95 : 0.65,
      )
      .strokeCircle(boss.x, boss.y, 16);
    for (const side of [-1, 1])
      overlay.lineBetween(
        boss.x + side * 12,
        boss.y - 8,
        boss.x + side * 12,
        boss.y + 8,
      );
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
