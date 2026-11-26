import { sustainedX, type SustainedRay } from "../src/game/sustained-fire";
import { clearance } from "./keyboard-policy";
interface Snapshot {
  player: { x: number; y: number };
  hostileProjectiles: { x: number; y: number; vx: number; vy: number }[];
  activeEnemies: { x: number; y: number; behavior?: string }[];
  sustainedFire: SustainedRay[];
  boss: { active: boolean; x: number; y: number } | null;
}
export function lateFrontDirection(s: Snapshot) {
  const { x, y } = s.player,
    target = s.boss?.active ? s.boss.x : 180;
  const nearby = s.hostileProjectiles.filter(
    (b) => b.y > y - 150 && b.y < y + 30,
  );
  const hulls = s.activeEnemies.filter(
    (e) =>
      e.y > y - 56 &&
      e.y < y + 28 &&
      !["groundBattery", "groundDepot", "flakBattery", "missileTruck"].includes(
        e.behavior ?? "",
      ),
  );
  return ([0, -1, 1] as const)
    .map((d) => {
      const px = Math.max(18, Math.min(342, x + 43 * d));
      const safe = clearance(
        { player: s.player, hostileProjectiles: nearby },
        d,
        Math.abs(px - x),
        0.32,
      );
      const ship = hulls.reduce(
        (sum, e) => sum + Math.max(0, 48 - Math.abs(px - e.x)) * 3,
        0,
      );
      const beam = s.sustainedFire.reduce(
        (sum, r) =>
          sum +
          (y < r.y
            ? 0
            : Math.max(
                0,
                r.width +
                  (Math.abs(r.slope) > 0.015 ? 30 : 11) -
                  Math.abs(px - sustainedX(r, y)),
              ) * 13),
        0,
      );
      return {
        d,
        cost:
          ship +
          beam +
          0.29 * Math.abs(px - target) +
          (d ? 3 : 0) +
          Math.max(0, 36 - safe) * 11,
      };
    })
    .sort((a, b) => a.cost - b.cost)[0].d;
}
