import { isGroundRole } from "../src/game/enemy-roles";
/** Test-only observation of current/previous visible hull positions. No model
 * methods, future waves, HP writes or production gameplay changes. */
export class VisibleHullTracker {
  private previous = new Map<number, {x: number; y: number; time: number; vx: number; vy: number}>();
  observe(time: number, enemies: readonly {id: number; x: number; y: number; behavior?: string}[]) {
    const next = new Map<number, {x: number; y: number; time: number; vx: number; vy: number}>();
    const hazards: {x: number; y: number; vx: number; vy: number}[] = [];
    for (const enemy of enemies) {
      if (isGroundRole(enemy.behavior) || enemy.x < 18 || enemy.x > 342 || enemy.y < 108 || enemy.y > 640) continue;
      const old = this.previous.get(enemy.id);
      let vx = old?.vx ?? 0, vy = old?.vy ?? 0;
      if (old && time > old.time + 0.001) {
        const dt = time - old.time;
        vx = Math.max(-600, Math.min(600, (enemy.x - old.x) / dt));
        vy = Math.max(-600, Math.min(600, (enemy.y - old.y) / dt));
      }
      next.set(enemy.id, {x: enemy.x, y: enemy.y, time, vx, vy});
      // Hull contact is wider than a projectile. These three observed probes
      // retain the existing delayed-touch safety model rather than steering
      // through an aircraft just because it has not emitted a bullet.
      for (const offset of [-18, 0, 18]) hazards.push({x: enemy.x + offset, y: enemy.y, vx, vy});
    }
    this.previous = next;
    return hazards;
  }
  get retainedHulls() { return this.previous.size; }
}
