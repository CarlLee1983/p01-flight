const COVERAGE_KINDS = new Set([
  "straight",
  "weave",
  "cross",
  "dive",
  "heavy",
  "turret",
  "carrier",
  "groundBattery",
  "groundDepot",
  "escort",
  "gatekeeper",
  "brakeRaider",
  "hookWing",
]);
type PresentationEvent = {time: number; wallMs: number; id?: number; x?: number; y?: number; turretAngle?: number};
interface ActiveObject {
  active: boolean;
}
interface RenderPopulation {
  effects?: readonly unknown[];
  enemies: readonly (ActiveObject & {
    behavior?: string;
    y?: number;
    hitUntil?: number;
    telegraph?: number;
    id?: number; x?: number; hp?: number; maxHp?: number;
    shotsFired?: number; gateCycle?: number; turretAngle?: number;
  })[];
  time?: number;
  bullets: readonly ActiveObject[];
  enemyBullets: readonly ActiveObject[];
}
/** Constant-space counters. Snapshot allocation happens only on explicit reads. */
export class RenderMetrics {
  private enemyCoverage: Record<
    string,
    { frames: number; hitFrames: number; chargeFrames: number; presentation?: Record<string, PresentationEvent> }
  > = {};
  private startedAt = performance.now();
  private frames = 0;
  private peakEffects = 0;
  private peakImpactPrimitives = 0;
  private drawTotalMs = 0;
  private drawMaxMs = 0;
  private peakEnemies = 0;
  private peakAirEnemies = 0;
  private peakPlayerBullets = 0;
  private peakEnemyBullets = 0;
  private peakSprites = 0;
  private spritePool = 0;
  reset() {
    this.enemyCoverage = {};
    this.startedAt = performance.now();
    this.peakEffects = this.peakImpactPrimitives = 0;
    this.frames = this.drawTotalMs = this.drawMaxMs = 0;
    this.peakEnemies = this.peakAirEnemies = this.peakPlayerBullets = 0;
    this.peakEnemyBullets = this.peakSprites = this.spritePool = 0;
  }
  sample(
    population: RenderPopulation,
    sprites: number,
    pool: number,
    drawMs: number,
    impactPrimitives = 0,
  ) {
    let enemies = 0,
      air = 0,
      playerBullets = 0,
      enemyBullets = 0;
    for (const e of population.enemies) {
      const role = e.behavior ?? "straight";
      if (COVERAGE_KINDS.has(role) && (e.y ?? -1) >= 80 && (e.y ?? 999) <= 640 && (e.maxHp ?? 0) > 0) {
        const coverage = (this.enemyCoverage[role] ??= {frames: 0, hitFrames: 0, chargeFrames: 0});
        const entry = (coverage.presentation ??= {});
        const record = (event: string) => { entry[event] ??= { time: population.time ?? 0, wallMs: performance.now() - this.startedAt, id: e.id, x: e.x, y: e.y, turretAngle: e.turretAngle }; };
        if (e.active && (e.x ?? 180) >= 18 && (e.x ?? 180) <= 342 && (e.y ?? -1) >= 108) record("visible");
        if ((e.shotsFired ?? 0) > 0 || (e.gateCycle ?? 0) > 0) record("fired");
        if ((e.hitUntil ?? 0) > (population.time ?? 0)) record("hit");
        if (!e.active && (e.hp ?? 1) <= 0) record("destroyed");
      }
      if (e.active) {
        enemies++;
        if ((e.y ?? -1) >= 80 && (e.y ?? 999) <= 640) {
          const key = COVERAGE_KINDS.has(e.behavior ?? "")
            ? e.behavior!
            : "straight";
          const entry = (this.enemyCoverage[key] ??= {
            frames: 0,
            hitFrames: 0,
            chargeFrames: 0,
          });
          entry.frames++;
          if ((e.hitUntil ?? 0) > (population.time ?? 0)) entry.hitFrames++;
          if ((e.telegraph ?? 0) > 0) entry.chargeFrames++;
        }
        if (
          e.behavior !== "groundBattery" &&
          e.behavior !== "groundDepot" &&
          e.behavior !== "gatekeeper"
        )
          air++;
      }
    }
    for (const b of population.bullets) if (b.active) playerBullets++;
    for (const b of population.enemyBullets) if (b.active) enemyBullets++;
    this.peakEffects = Math.max(
      this.peakEffects,
      population.effects?.length ?? 0,
    );
    this.peakImpactPrimitives = Math.max(
      this.peakImpactPrimitives,
      impactPrimitives,
    );
    this.frames++;
    const duration = Math.max(0, Number.isFinite(drawMs) ? drawMs : 0);
    this.drawTotalMs += duration;
    this.drawMaxMs = Math.max(this.drawMaxMs, duration);
    this.peakEnemies = Math.max(this.peakEnemies, enemies);
    this.peakAirEnemies = Math.max(this.peakAirEnemies, air);
    this.peakPlayerBullets = Math.max(this.peakPlayerBullets, playerBullets);
    this.peakEnemyBullets = Math.max(this.peakEnemyBullets, enemyBullets);
    this.peakSprites = Math.max(this.peakSprites, sprites);
    this.spritePool = Math.max(this.spritePool, pool);
  }
  snapshot() {
    return {
      frames: this.frames,
      enemyCoverage: { ...this.enemyCoverage },
      presentationCoverage: Object.fromEntries(Object.entries(this.enemyCoverage).filter(([, entry]) => entry.presentation).map(([role, entry]) => [role, structuredClone(entry.presentation)])),
      peakEffects: this.peakEffects,
      peakImpactPrimitives: this.peakImpactPrimitives,
      meanDrawCpuMs: this.frames ? this.drawTotalMs / this.frames : 0,
      maxDrawCpuMs: this.drawMaxMs,
      peakEnemies: this.peakEnemies,
      peakAirEnemies: this.peakAirEnemies,
      peakPlayerBullets: this.peakPlayerBullets,
      peakEnemyBullets: this.peakEnemyBullets,
      peakSprites: this.peakSprites,
      spritePool: this.spritePool,
      // CPU draw-command generation, not GPU completion or input latency.
      timingScope: "draw-command-cpu" as const,
    };
  }
}
