import type { Behavior, PickupKind, StageConfig } from "../data/stage";
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
  behavior?: Behavior;
  age?: number;
  originX?: number;
  fireCooldown?: number;
  fireEvery?: number;
  drop?: PickupKind;
}
export interface EnemyBullet extends Body {
  vx: number;
  vy: number;
}
export interface Pickup extends Body {
  kind: PickupKind;
}
export interface Boss {
  active: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  age: number;
  fireCooldown: number;
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
  enemyBullets: EnemyBullet[] = [];
  pickups: Pickup[] = [];
  boss: Boss | null = null;
  bossDefeated = false;
  weaponTime = 0;
  lostReason: "damage" | "timeout" | null = null;
  effects: { x: number; y: number; life: number }[] = [];
  shots = 0;
  nextWave = 0;
  cooldown = 0;
  private serial = 0;
  private nextPickup = 0;
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
    this.enemyBullets = [];
    this.pickups = [];
    this.boss = null;
    this.bossDefeated = false;
    this.weaponTime = 0;
    this.lostReason = null;
    this.effects = [];
    this.shots = 0;
    this.nextWave = 0;
    this.nextPickup = 0;
    this.cooldown = 0;
    this.serial = 0;
  }
  pause() {
    if (this.mode === "playing") this.mode = "paused";
    else if (this.mode === "paused") this.mode = "playing";
  }
  private shootEnemy(x: number, y: number, vx: number, vy: number) {
    let b = this.enemyBullets.find((b) => !b.active);
    if (!b) {
      b = { id: ++this.serial, x, y, vx, vy, active: true };
      this.enemyBullets.push(b);
    }
    Object.assign(b, { x, y, vx, vy, active: true });
  }
  private drop(x: number, y: number, kind: PickupKind) {
    let p = this.pickups.find((p) => !p.active);
    if (!p) {
      p = { id: ++this.serial, x, y, kind, active: true };
      this.pickups.push(p);
    }
    Object.assign(p, { x, y, kind, active: true });
  }
  private damage() {
    if (this.invincible > 0 || this.mode !== "playing") return;
    this.hp--;
    this.invincible = 1.5;
    this.effects.push({ ...this.player, life: 0.4 });
    if (this.hp <= 0) {
      this.mode = "lost";
      this.lostReason = "damage";
    }
  }
  update(dt: number, dx = 0, dy = 0, fire = false) {
    if (this.mode !== "playing") return;
    dt = Math.min(Math.max(dt, 0), 0.05);
    this.time += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.weaponTime = Math.max(0, this.weaponTime - dt);
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
      for (const offset of this.weaponTime > 0 ? [-8, 8] : [0]) {
        let b = this.bullets.find((b) => !b.active);
        if (!b) {
          b = { id: ++this.serial, x: 0, y: 0, active: false };
          this.bullets.push(b);
        }
        Object.assign(b, {
          x: this.player.x + offset,
          y: this.player.y - 26,
          active: true,
        });
      }
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
      Object.assign(
        e,
        { behavior: "straight", fireEvery: undefined, drop: undefined },
        w,
        {
          y: -24,
          active: true,
          age: 0,
          originX: w.x,
          fireCooldown: w.fireEvery ?? 999,
        },
      );
    }
    const supplies = this.stage.pickups ?? [];
    while (
      this.nextPickup < supplies.length &&
      supplies[this.nextPickup].at <= this.time
    ) {
      const p = supplies[this.nextPickup++];
      this.drop(p.x, -20, p.kind);
    }
    if (this.stage.boss && !this.boss && this.time >= this.stage.boss.at)
      this.boss = {
        x: this.stage.width / 2,
        y: -60,
        active: true,
        hp: this.stage.boss.hp,
        maxHp: this.stage.boss.hp,
        age: 0,
        fireCooldown: 3.5,
      };
    for (const b of this.bullets)
      if (b.active) {
        b.y -= 550 * dt;
        if (b.y < -24) b.active = false;
      }
    for (const e of this.enemies)
      if (e.active) {
        e.age = (e.age ?? 0) + dt;
        if (e.behavior === "weave")
          e.x = Math.max(
            25,
            Math.min(
              this.stage.width - 25,
              (e.originX ?? e.x) + Math.sin(e.age * 2.6) * 38,
            ),
          );
        if (!(e.behavior === "turret" && e.y >= 150 && e.age < 6))
          e.y += e.speed * dt;
        if (e.fireEvery && e.y > 40 && e.y < 400) {
          e.fireCooldown = (e.fireCooldown ?? e.fireEvery) - dt;
          if (e.fireCooldown <= 0) {
            this.shootEnemy(e.x, e.y + 20, 0, 165);
            e.fireCooldown = e.fireEvery;
          }
        }
        if (e.y > this.stage.height + 30) e.active = false;
      }
    if (this.boss?.active && this.stage.boss) {
      const boss = this.boss;
      boss.age += dt;
      boss.y = Math.min(105, boss.y + 100 * dt);
      boss.fireCooldown -= dt;
      if (boss.y >= 105 && boss.fireCooldown <= 0) {
        const aim = Math.atan2(this.player.x - boss.x, this.player.y - boss.y);
        for (const spread of boss.hp > boss.maxHp / 2
          ? [-0.24, 0.24]
          : [-0.3, 0, 0.3])
          this.shootEnemy(
            boss.x,
            boss.y + 28,
            Math.sin(aim + spread) * this.stage.boss.bulletSpeed,
            Math.cos(aim + spread) * this.stage.boss.bulletSpeed,
          );
        boss.fireCooldown = this.stage.boss.fireEvery;
      }
    }
    for (const b of this.enemyBullets)
      if (b.active) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (
          b.x < -20 ||
          b.x > this.stage.width + 20 ||
          b.y < -20 ||
          b.y > this.stage.height + 20
        )
          b.active = false;
        if (
          b.active &&
          Math.hypot(b.x - this.player.x, b.y - this.player.y) < 12
        ) {
          b.active = false;
          this.damage();
        }
      }
    for (const p of this.pickups)
      if (p.active) {
        p.y += 100 * dt;
        if (p.y > this.stage.height + 20) p.active = false;
        if (
          p.active &&
          Math.hypot(p.x - this.player.x, p.y - this.player.y) < 26
        ) {
          p.active = false;
          if (p.kind === "heal") this.hp = Math.min(3, this.hp + 1);
          else this.weaponTime = 15;
          this.effects.push({ x: p.x, y: p.y, life: 0.45 });
        }
      }
    for (const b of this.bullets)
      if (b.active) {
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
              if (e.drop) this.drop(e.x, e.y, e.drop);
            }
            break;
          }
        const boss = this.boss;
        if (
          b.active &&
          boss?.active &&
          Math.abs(b.x - boss.x) < 48 &&
          Math.abs(b.y - boss.y) < 36
        ) {
          b.active = false;
          boss.hp--;
          this.effects.push({ x: b.x, y: b.y, life: 0.25 });
          if (boss.hp <= 0) {
            boss.active = false;
            this.bossDefeated = true;
            this.score += this.stage.boss!.points;
            this.effects.push({ x: boss.x, y: boss.y, life: 0.45 });
            if (this.mode === "playing") this.mode = "won";
          }
        }
      }
    for (const e of this.enemies)
      if (
        e.active &&
        Math.hypot(e.x - this.player.x, e.y - this.player.y) < 25 &&
        this.invincible <= 0
      ) {
        e.active = false;
        this.damage();
      }
    if (
      this.boss?.active &&
      Math.abs(this.boss.x - this.player.x) < 50 &&
      Math.abs(this.boss.y - this.player.y) < 42
    )
      this.damage();
    this.effects = this.effects
      .map((e) => ({ ...e, life: e.life - dt }))
      .filter((e) => e.life > 0);
    if (this.mode === "playing" && this.time >= this.stage.duration) {
      this.time = this.stage.duration;
      this.mode = this.stage.boss ? "lost" : "won";
      if (this.stage.boss) this.lostReason = "timeout";
    }
  }
}
