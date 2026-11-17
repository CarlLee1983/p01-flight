/** Bounded diagnostic history: no unbounded per-frame recording. */
export class TouchTrace {
  readonly samples: Record<string, unknown>[] = [];
  readonly damage: Record<string, unknown>[] = [];
  private hp = 3;
  record(sample: Record<string, unknown> & { hp: number }) {
    if (sample.hp < this.hp) {
      this.damage.push({ ...sample });
      if (this.damage.length > 16) this.damage.shift();
    }
    this.hp = sample.hp;
    this.samples.push(sample);
    if (this.samples.length > 96) this.samples.shift();
  }
  json() {
    return JSON.stringify(
      { samples: this.samples, damage: this.damage },
      null,
      2,
    );
  }
}
