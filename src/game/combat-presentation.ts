import { bossMuzzle } from "./boss-muzzles";
import type { Boss } from "./model";
/** All combat imagery is below the opaque HUD plate; labels stay above it. */
export const PRESENTATION_LAYERS = { combatMax: 4, hud: 4.5, text: 5 } as const;
export const CANNON_ART = { width: 32, height: 48, muzzleY: 22 } as const;
/** A fan may have several rays from one reactor. Charge that source once,
 * while preserving every individual forecast ray in the renderer. */
export function bossChargeSources(boss: Boss) {
  const sources: { x: number; y: number }[] = [];
  for (let i = 0; i < boss.attackAngles.length; i++) {
    const m = bossMuzzle(boss, i, boss.attackAngles.length);
    if (m.active && !sources.some((p) => p.x === m.x && p.y === m.y))
      sources.push({ x: m.x, y: m.y });
  }
  return sources;
}
