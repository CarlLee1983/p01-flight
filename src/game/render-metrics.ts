interface ActiveObject {
  active: boolean;
}
interface RenderPopulation {
  effects?: readonly unknown[];
  enemies: readonly (ActiveObject & { behavior?: string })[];
  bullets: readonly ActiveObject[];
  enemyBullets: readonly ActiveObject[];
}
/** Constant-space counters. Snapshot allocation happens only on explicit reads. */
export class RenderMetrics {
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
    for (const e of population.enemies)
      if (e.active) {
        enemies++;
        if (
          e.behavior !== "groundBattery" &&
          e.behavior !== "groundDepot" &&
          e.behavior !== "gatekeeper"
        )
          air++;
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
