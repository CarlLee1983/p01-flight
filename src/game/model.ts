import type { StageConfig } from "../data/stage";
export type Mode = "menu" | "playing" | "paused" | "won" | "lost";
export interface Body {
  id: number;
  x: number;
  y: number;
  active: boolean;
}
export interface Enemy extends Body {
  speed: number;
  hp: number;
  points: number;
}
export class FlightModel {
  mode: Mode = "menu";
  time = 0;
  score = 0;
  hp = 3;
  invincible = 0;
  player = { x: 180, y: 540 };
  bullets: Body[] = [];
  enemies: Enemy[] = [];
  effects: { x: number; y: number; life: number }[] = [];
  shots = 0;
  nextWave = 0;
  cooldown = 0;
  private serial = 0;
  constructor(public stage: StageConfig) {}
  start() {
    this.mode = "playing";
    this.time = 0;
    this.score = 0;
    this.hp = 3;
    this.invincible = 0;
    this.player = { x: this.stage.width / 2, y: this.stage.height - 100 };
    this.bullets = [];
    this.enemies = [];
    this.effects = [];
    this.shots = 0;
    this.nextWave = 0;
    this.cooldown = 0;
    this.serial = 0;
  }
  pause() {
    if (this.mode === "playing") this.mode = "paused";
    else if (this.mode === "paused") this.mode = "playing";
  }
  update(dt: number, dx = 0, dy = 0, fire = false) {
    if (this.mode !== "playing") return;
    dt = Math.min(Math.max(dt, 0), 0.05);
    this.time += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.cooldown -= dt;
    const length = Math.hypot(dx, dy);
    if (length) {
      this.player.x += (dx / length) * 240 * dt;
      this.player.y += (dy / length) * 240 * dt;
    }
    this.player.x = Math.max(
      18,
      Math.min(this.stage.width - 18, this.player.x),
    );
    this.player.y = Math.max(
      70,
      Math.min(this.stage.height - 24, this.player.y),
    );
    if (fire && this.cooldown <= 0) {
      let b = this.bullets.find((b) => !b.active);
      if (!b) {
        b = { id: ++this.serial, x: 0, y: 0, active: false };
        this.bullets.push(b);
      }
      Object.assign(b, {
        x: this.player.x,
        y: this.player.y - 26,
        active: true,
      });
      this.cooldown = 0.14;
      this.shots++;
    }
    while (
      this.nextWave < this.stage.waves.length &&
      this.stage.waves[this.nextWave].at <= this.time
    ) {
      const w = this.stage.waves[this.nextWave++];
      let e = this.enemies.find((e) => !e.active);
      if (!e) {
        e = {
          id: ++this.serial,
          x: 0,
          y: 0,
          active: false,
          speed: 0,
          hp: 0,
          points: 0,
        };
        this.enemies.push(e);
      }
      Object.assign(e, w, { y: -24, active: true });
    }
    for (const b of this.bullets)
      if (b.active) {
        b.y -= 550 * dt;
        if (b.y < -24) b.active = false;
      }
    for (const e of this.enemies)
      if (e.active) {
        e.y += e.speed * dt;
        if (e.y > this.stage.height + 30) e.active = false;
      }
    for (const b of this.bullets)
      if (b.active)
        for (const e of this.enemies)
          if (
            e.active &&
            Math.abs(b.x - e.x) < 22 &&
            Math.abs(b.y - e.y) < 25
          ) {
            b.active = false;
            e.hp--;
            this.effects.push({ x: b.x, y: b.y, life: 0.25 });
            if (e.hp <= 0) {
              e.active = false;
              this.score += e.points;
            }
            break;
          }
    for (const e of this.enemies)
      if (
        e.active &&
        Math.hypot(e.x - this.player.x, e.y - this.player.y) < 25 &&
        this.invincible <= 0
      ) {
        e.active = false;
        this.hp--;
        this.invincible = 1.5;
        this.effects.push({ x: this.player.x, y: this.player.y, life: 0.4 });
        if (this.hp <= 0) {
          this.mode = "lost";
          break;
        }
      }
    this.effects = this.effects
      .map((e) => ({ ...e, life: e.life - dt }))
      .filter((e) => e.life > 0);
    if (this.mode === "playing" && this.time >= this.stage.duration) {
      this.time = this.stage.duration;
      this.mode = "won";
    }
  }
}
