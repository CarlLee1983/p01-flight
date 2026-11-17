import { raiderMuzzle } from "./raider-geometry";
import {
  groundMuzzle,
  hostileStyle,
  turnToward,
  type HostileStyle,
} from "./hostile-visuals";
import { bossMuzzle, bossSideAngles } from "./boss-muzzles";
import { fastAttackAngles, isFastShooter } from "./enemy-patterns";
import { GROUND_SCROLL_SPEED, GROUND_VISIBLE_Y } from "../data/stage";
import type { Behavior, PickupKind, StageConfig } from "../data/stage";
export type Mode = "menu" | "playing" | "paused" | "won" | "lost";
export interface Body {
  id: number;
  x: number;
  y: number;
  active: boolean;
  vx?: number;
  vy?: number;
  damage?: number;
  kind?: "spread" | "beam" | "missile" | PickupKind;
  width?: number;
  targetId?: number;
  life?: number;
  pierceRemaining?: number;
  hitIds?: number[];
}
export interface Enemy extends Body {
  enteredPlayfield?: boolean;
  brakeElapsed?: number;
  maxHp?: number;
  speed: number;
  hp: number;
  points: number;
  behavior?: Behavior;
  age?: number;
  originX?: number;
  fireCooldown?: number;
  fireEvery?: number;
  shotsFired?: number;
  visibleSince?: number;
  turretAngle?: number;
  turretHoldUntil?: number;
  drop?: PickupKind;
  telegraph?: number;
  aimAngle?: number;
  direction?: number;
  diveAngle?: number;
  holdFor?: number;
  strafeWidth?: number;
  formationPhase?: number;
  volleyFired?: boolean;
  gateCycle?: number;
  attackPattern?: "left" | "right" | "aim";
  attackLanes?: number[];
  attackAngles?: number[];
}
export interface EnemyBullet extends Body {
  visual?: HostileStyle;
  bornAt?: number;
  muzzleX?: number;
  muzzleY?: number;
  vx: number;
  vy: number;
}
export interface Pickup extends Body {
  kind: PickupKind;
}
export interface BossPart {
  id: number;
  side: -1 | 1;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  active: boolean;
}
export interface Boss {
  attackWarning: number;
  attackAngles: number[];
  attackCycle: number;
  cannons: BossPart[];
  phase: 1 | 2 | 3;
  telegraph: number;
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
  emittedEnemyShots = 0;
  emittedBossShots = 0;
  private pendingShots: {
    at: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    source: Enemy | Boss;
    sourceId?: number;
    boss: boolean;
    visual: HostileStyle;
    guard?: BossPart;
  }[] = [];
  boss: Boss | null = null;
  bossDefeated = false;
  partsDestroyed = 0;
  groundShotCount = 0;
  spawnedAir = 0;
  enteredAir = 0;
  weaponTime = 0; // Compatibility field: 1 while permanently upgraded.
  weaponLevel = 1;
  weaponMode: "spread" | "beam" | "missile" = "spread";
  focus = false;
  supportTime = 0;
  supportShots = 0;
  private supportCooldown = 0;
  bombs = 2;
  bombFlash = 0;
  killCount = 0;
  damageCount = 0;
  pickupCount = 0;
  lastPickup: PickupKind | null = null;
  lostReason: "damage" | "timeout" | null = null;
  effects: { x: number; y: number; life: number; kind?: "hit" }[] = [];
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
    this.pendingShots = [];
    this.emittedEnemyShots = 0;
    this.emittedBossShots = 0;
    this.pickups = [];
    this.boss = null;
    this.bossDefeated = false;
    this.partsDestroyed = 0;
    this.groundShotCount = 0;
    this.spawnedAir = 0;
    this.enteredAir = 0;
    this.weaponTime = 0;
    this.weaponLevel = 1;
    this.weaponMode = "spread";
    this.focus = false;
    this.supportTime = 0;
    this.supportShots = 0;
    this.supportCooldown = 0;
    this.bombs = 2;
    this.bombFlash = 0;
    this.killCount = 0;
    this.damageCount = 0;
    this.pickupCount = 0;
    this.lastPickup = null;
    this.lostReason = null;
    this.effects = [];
    this.shots = 0;
    this.nextWave = 0;
    this.nextPickup = 0;
    this.cooldown = 0;
    this.serial = 0;
  }
  get section() {
    return (
      [...(this.stage.sections ?? [])]
        .reverse()
        .find((section) => section.at <= this.time) ?? {
        id: "stage",
        title: this.stage.title,
        at: 0,
        hint: "擊破敵機，保持生存",
      }
    );
  }
  get supportDrones(): { x: number; y: number }[] {
    if (this.supportTime <= 0) return [];
    return [-32, 32].map((offset) => ({
      x: Math.max(8, Math.min(this.stage.width - 8, this.player.x + offset)),
      y: this.player.y + 12,
    }));
  }
  pause() {
    if (this.mode === "playing") this.mode = "paused";
    else if (this.mode === "paused") this.mode = "playing";
  }
  switchWeapon(): boolean {
    if (this.mode !== "playing") return false;
    this.weaponMode =
      this.weaponMode === "spread"
        ? "beam"
        : this.weaponMode === "beam"
          ? "missile"
          : "spread";
    return true;
  }
  /** Call once per input edge, never once per held-key frame. */
  useBomb(): boolean {
    if (this.mode !== "playing" || this.bombs <= 0 || this.bombFlash > 0)
      return false;
    this.bombs--;
    this.bombFlash = 0.65;
    this.invincible = Math.max(this.invincible, 2);
    for (const b of this.enemyBullets) b.active = false;
    this.pendingShots = [];
    for (const e of this.enemies)
      if (this.interactable(e)) {
        e.hp -= 12;
        if (e.hp <= 0) this.destroyEnemy(e);
      }
    if (this.boss?.active) {
      this.boss.hp -= 18;
      for (const part of this.boss.cannons)
        if (part.active) {
          part.hp -= 6;
          this.finishPart(part);
        }
      this.finishBoss();
    }
    return true;
  }
  private interactable(e: Enemy): boolean {
    const ground =
      e.behavior === "groundBattery" || e.behavior === "groundDepot";
    // Let an aircraft enter below the HUD / inside the side edge before it can
    // be hit or missile-locked. This also makes entrances observable at low FPS.
    return (
      e.active &&
      e.y >= GROUND_VISIBLE_Y &&
      e.y <= this.stage.height + 26 &&
      (ground || (e.x >= 18 && e.x <= this.stage.width - 18))
    );
  }
  private destroyEnemy(e: Enemy) {
    if (!e.active) return;
    e.active = false;
    this.killCount++;
    this.score += e.points;
    this.effects.push({ x: e.x, y: e.y, life: 0.45 });
    if (e.drop) this.drop(e.x, e.y, e.drop);
  }
  private finishPart(part: BossPart) {
    if (!part.active || part.hp > 0) return;
    part.hp = 0;
    part.active = false;
    this.partsDestroyed++;
    if (this.boss?.active) {
      this.boss.hp -= 12;
      this.finishBoss();
    }
    this.score += 250;
    this.effects.push({ x: part.x, y: part.y, life: 0.45 });
  }
  private finishBoss() {
    if (!this.boss?.active || this.boss.hp > 0) return;
    this.boss.hp = 0;
    this.boss.active = false;
    this.bossDefeated = true;
    this.killCount++;
    this.score += this.stage.boss!.points;
    this.effects.push({ x: this.boss.x, y: this.boss.y, life: 0.6 });
    if (this.mode === "playing") this.mode = "won";
  }
  // A burst repeats the same warned trajectory, not a wider impassable fan.
  // Tails follow the live emitter; destruction/bomb/phase changes cancel them.
  private shootEnemy(
    x: number,
    y: number,
    vx: number,
    vy: number,
    source: Enemy | Boss,
    guard?: BossPart,
  ) {
    const boss = source === this.boss;
    const visual = hostileStyle(
      boss,
      "behavior" in source ? source.behavior : undefined,
    );
    const count = boss
      ? (this.stage.boss?.burstShots ?? 1)
      : (this.stage.enemyBurstShots ?? 1);
    if (
      !boss &&
      "behavior" in source &&
      isFastShooter(source.behavior) &&
      count > 1
    ) {
      const angles = source.attackAngles?.length
        ? source.attackAngles
        : fastAttackAngles(
            source.behavior,
            source.shotsFired ?? 0,
            source.direction,
          );
      const speed = Math.hypot(vx, vy);
      angles.forEach((angle, i) => {
        const muzzle = i === 0 ? -9 : 9;
        // These two hulls have fixed twin barrels, not gimballed muzzles.
        const fixedBarrels =
          source.behavior === "brakeRaider" || source.behavior === "hookWing";
        const socket = fixedBarrels
          ? raiderMuzzle(source, i)
          : {
              x: x + Math.cos(angle) * muzzle,
              y: y - Math.sin(angle) * muzzle,
            };
        this.emitEnemyBullet(
          socket.x,
          socket.y,
          Math.sin(angle) * speed,
          Math.cos(angle) * speed,
          false,
          visual,
        );
      });
      return;
    }
    this.emitEnemyBullet(x, y, vx, vy, boss, visual);
    // Slow emitters use genuinely separated pulses. The earlier 0.12s train
    // was visually merged; Boss now has 30.8px nominal separation, not 16.8px.
    const spacing = boss
      ? 0.22
      : "behavior" in source && source.behavior === "escort"
        ? 0.4
        : 0.34;
    for (let i = 1; i < count; i++)
      this.pendingShots.push({
        at: this.time + i * spacing,
        x: x - source.x,
        y: y - source.y,
        vx,
        vy,
        source,
        sourceId: "id" in source ? source.id : undefined,
        boss,
        visual,
        guard,
      });
  }
  private emitEnemyBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    boss: boolean,
    visual: HostileStyle,
  ) {
    if (boss) this.emittedBossShots++;
    else this.emittedEnemyShots++;
    let b = this.enemyBullets.find((b) => !b.active);
    if (!b) {
      b = { id: ++this.serial, x, y, vx, vy, active: true };
      this.enemyBullets.push(b);
    }
    Object.assign(b, {
      x,
      y,
      vx,
      vy,
      active: true,
      visual,
      bornAt: this.time,
      muzzleX: x,
      muzzleY: y,
    });
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
    this.damageCount++;
    this.invincible = 1.5;
    this.effects.push({ ...this.player, life: 0.4 });
    if (this.hp <= 0) {
      this.mode = "lost";
      this.lostReason = "damage";
    }
  }
  update(
    dt: number,
    dx = 0,
    dy = 0,
    fire = false,
    focus = false,
    moveTarget?: { x: number; y: number },
  ) {
    if (this.mode !== "playing") return;
    dt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.05) : 0;
    this.focus = focus;
    this.time += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.bombFlash = Math.max(0, this.bombFlash - dt);
    this.cooldown -= dt;
    this.supportTime = Math.max(0, this.supportTime - dt);
    this.supportCooldown = Math.max(0, this.supportCooldown - dt);
    const target =
      moveTarget &&
      Number.isFinite(moveTarget.x) &&
      Number.isFinite(moveTarget.y)
        ? {
            x: Math.max(18, Math.min(this.stage.width - 18, moveTarget.x)),
            y: Math.max(70, Math.min(this.stage.height - 24, moveTarget.y)),
          }
        : undefined;
    if (target) {
      dx = target.x - this.player.x;
      dy = target.y - this.player.y;
    }
    const length = Math.hypot(dx, dy);
    if (length && Number.isFinite(length)) {
      const step = (focus ? 100 : 240) * dt;
      const travel = target ? Math.min(length, step) : step;
      this.player.x += (dx / length) * travel;
      this.player.y += (dy / length) * travel;
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
      for (const angle of this.weaponMode === "missile"
        ? this.weaponLevel === 1
          ? [0]
          : [-0.22, 0.22]
        : this.weaponMode === "beam"
          ? [0]
          : this.weaponLevel === 3
            ? [-0.24, -0.12, 0, 0.12, 0.24]
            : this.weaponLevel === 2
              ? [-0.14, 0, 0.14]
              : [0]) {
        let b = this.bullets.find((b) => !b.active);
        if (!b) {
          b = { id: ++this.serial, x: 0, y: 0, active: false };
          this.bullets.push(b);
        }
        Object.assign(b, {
          x: this.player.x,
          vx: Math.sin(angle) * (this.weaponMode === "missile" ? 330 : 550),
          vy:
            -Math.cos(angle) *
            (this.weaponMode === "beam"
              ? 850
              : this.weaponMode === "missile"
                ? 330
                : 550),
          damage:
            this.weaponMode === "beam"
              ? [2, 3, 4][this.weaponLevel - 1]
              : this.weaponMode === "missile"
                ? [5, 3.5, 4.5][this.weaponLevel - 1]
                : 1,
          kind: this.weaponMode,
          targetId: undefined,
          life: this.weaponMode === "missile" ? 3.5 : undefined,
          pierceRemaining:
            this.weaponMode === "beam" ? this.weaponLevel + 1 : 1,
          hitIds: [],
          width:
            this.weaponMode === "beam" ? [5, 8, 12][this.weaponLevel - 1] : 4,
          y: this.player.y - 26,
          active: true,
        });
      }
      this.cooldown =
        this.weaponMode === "beam"
          ? 0.22
          : this.weaponMode === "missile"
            ? 0.65
            : 0.14;
      this.shots++;
    }
    // Support is held-fire assistance, never an invulnerable collision shield.
    if (fire && this.supportTime > 0 && this.supportCooldown <= 0) {
      for (const drone of this.supportDrones) {
        let bullet = this.bullets.find((b) => !b.active);
        if (!bullet) {
          bullet = { id: ++this.serial, x: 0, y: 0, active: false };
          this.bullets.push(bullet);
        }
        Object.assign(bullet, {
          x: drone.x,
          y: drone.y - 12,
          active: true,
          vx: 0,
          vy: -550,
          kind: "support",
          damage: 1,
          width: 4,
          targetId: undefined,
          life: undefined,
          pierceRemaining: 1,
          hitIds: [],
        });
      }
      this.supportShots++;
      this.supportCooldown = 0.28;
    }
    while (
      this.nextWave < this.stage.waves.length &&
      this.stage.waves[this.nextWave].at <= this.time
    ) {
      const w = this.stage.waves[this.nextWave++];
      if (
        !["groundBattery", "groundDepot", "gatekeeper"].includes(
          w.behavior ?? "straight",
        )
      )
        this.spawnedAir++;
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
          id: ++this.serial,
          maxHp: w.hp,
          y: w.spawnY ?? -24,
          active: true,
          age: 0,
          originX: w.x,
          fireCooldown:
            w.behavior === "gatekeeper"
              ? 1.4
              : (w.firstFireDelay ?? w.fireEvery ?? 999),
          telegraph: 0,
          aimAngle: undefined,
          turretAngle: 0,
          turretHoldUntil: 0,
          shotsFired: 0,
          visibleSince: undefined,
          enteredPlayfield: false,
          brakeElapsed: undefined,
          formationPhase: w.formationPhase ?? 0,
          volleyFired: false,
          holdFor: w.holdFor,
          strafeWidth: w.strafeWidth,
          gateCycle: 0,
          attackPattern: undefined,
          attackLanes: [],
          attackAngles: [],
          direction: w.direction ?? 1,
          diveAngle: undefined,
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
        cannons: this.stage.boss.sideCannonHp
          ? ([-1, 1] as const).map((side) => ({
              id: side === -1 ? -2 : -3,
              side,
              x: this.stage.width / 2 + side * 68,
              y: -40,
              hp: this.stage.boss!.sideCannonHp!,
              maxHp: this.stage.boss!.sideCannonHp!,
              active: true,
            }))
          : [],
        phase: 1,
        attackWarning: 0,
        attackAngles: [],
        attackCycle: 0,
        telegraph: 1.2,
        x: this.stage.width / 2,
        y: -60,
        active: true,
        hp: this.stage.boss.hp,
        maxHp: this.stage.boss.hp,
        age: 0,
        fireCooldown: 0.8,
      };
    for (const b of this.bullets)
      if (b.active) {
        if (b.kind === "missile") {
          b.life = (b.life ?? 3.5) - dt;
          const targets = this.enemies.filter(
            (e) => this.interactable(e) && e.y < b.y + 60,
          );
          const candidates = [
            ...(this.boss?.active
              ? this.boss.cannons
                  .filter((p) => p.active && p.y < b.y + 60)
                  .map((p) => ({ id: p.id, x: p.x, y: p.y }))
              : []),
            ...targets.map((e) => ({ id: e.id, x: e.x, y: e.y })),
            ...(this.boss?.active && this.boss.y < b.y + 60
              ? [{ id: -1, x: this.boss.x, y: this.boss.y }]
              : []),
          ];
          const target =
            candidates.find((e) => e.id === b.targetId) ??
            candidates.sort(
              (a, c) =>
                Math.hypot(a.x - b.x, a.y - b.y) -
                Math.hypot(c.x - b.x, c.y - b.y),
            )[0];
          b.targetId = target?.id;
          if (target) {
            const angle = Math.atan2(b.vy ?? -330, b.vx ?? 0);
            const desired = Math.atan2(target.y - b.y, target.x - b.x);
            const delta = Math.atan2(
              Math.sin(desired - angle),
              Math.cos(desired - angle),
            );
            const next = angle + Math.max(-4 * dt, Math.min(4 * dt, delta));
            b.vx = Math.cos(next) * 330;
            b.vy = Math.sin(next) * 330;
          }
          if (b.life <= 0) b.active = false;
        }
        b.x += (b.vx ?? 0) * dt;
        b.y += (b.vy ?? -550) * dt;
        if (
          b.y < -24 ||
          b.x < -24 ||
          b.x > this.stage.width + 24 ||
          b.y > this.stage.height + 30
        )
          b.active = false;
      }
    for (const e of this.enemies)
      if (e.active) {
        e.age = (e.age ?? 0) + dt;
        const ground =
          e.behavior === "groundBattery" || e.behavior === "groundDepot";
        if (ground) {
          e.y += (this.stage.groundSpeed ?? GROUND_SCROLL_SPEED) * dt;
          if (this.interactable(e) && e.visibleSince === undefined)
            e.visibleSince = this.time;
        }
        if (e.behavior === "cross" || e.behavior === "carrier") {
          e.x += (e.direction ?? 1) * e.speed * dt;
        }
        if (e.behavior === "gatekeeper") {
          const holding = e.age < (e.holdFor ?? 9);
          if (holding) {
            e.y = Math.min(150, e.y + e.speed * dt);
            e.x =
              (e.originX ?? 180) +
              Math.sin(e.age * 0.9) * (e.strafeWidth ?? 75);
            e.attackPattern = (["left", "right", "aim"] as const)[
              (e.gateCycle ?? 0) % 3
            ];
            e.attackLanes =
              e.attackPattern === "left"
                ? [0.15, 0.28, 0.41].map((x) => x * this.stage.width)
                : e.attackPattern === "right"
                  ? [0.59, 0.72, 0.85].map((x) => x * this.stage.width)
                  : [];
            if (e.y >= 150) {
              e.fireCooldown = (e.fireCooldown ?? 1.4) - dt;
              if (e.fireCooldown <= 0.75 && e.aimAngle === undefined)
                e.aimAngle = Math.atan2(
                  this.player.x - e.x,
                  this.player.y - e.y,
                );
              e.telegraph =
                e.fireCooldown > 0 && e.fireCooldown <= 0.75
                  ? e.fireCooldown
                  : 0;
              if (e.fireCooldown <= 0) {
                if (e.attackPattern === "aim")
                  this.shootEnemy(
                    e.x,
                    e.y + 24,
                    Math.sin(e.aimAngle ?? 0) * 180,
                    Math.cos(e.aimAngle ?? 0) * 180,
                    e,
                  );
                else
                  for (const x of e.attackLanes)
                    this.shootEnemy(x, e.y + 24, 0, 180, e);
                e.gateCycle = (e.gateCycle ?? 0) + 1;
                e.fireCooldown = e.fireEvery ?? 2.2;
                e.aimAngle = undefined;
                e.attackPattern = undefined;
                e.attackLanes = [];
              }
            }
          } else {
            e.y += e.speed * dt;
            e.telegraph = 0;
            e.attackPattern = undefined;
            e.attackLanes = [];
          }
        }
        if (e.behavior === "dive") {
          if (e.age >= 1 && e.diveAngle === undefined)
            e.diveAngle = Math.atan2(this.player.x - e.x, this.player.y - e.y);
          if (e.age >= 1 && e.age < 1.7) {
            e.telegraph = 1.7 - e.age;
            e.aimAngle = e.diveAngle;
          }
          if (e.age >= 1.7) e.telegraph = 0;
          if (e.age >= 1.7 && e.diveAngle !== undefined) {
            e.x += Math.sin(e.diveAngle) * 260 * dt;
            e.y += Math.cos(e.diveAngle) * 260 * dt;
          } else if (e.age < 1) e.y += e.speed * dt;
        }
        if (e.behavior === "escort") {
          e.x =
            (e.originX ?? e.x) +
            Math.sin((e.age + (e.formationPhase ?? 0)) * 1.2) * 24;
          if (!e.volleyFired && e.age >= 0.9) {
            if (e.aimAngle === undefined)
              e.aimAngle = Math.atan2(this.player.x - e.x, this.player.y - e.y);
            e.telegraph = Math.max(0, 1.7 - e.age);
            if (e.age >= 1.7) {
              for (const spread of [-0.22, 0, 0.22])
                this.shootEnemy(
                  e.x,
                  e.y + 20,
                  Math.sin(e.aimAngle + spread) * 155,
                  Math.cos(e.aimAngle + spread) * 155,
                  e,
                );
              e.volleyFired = true;
              e.telegraph = 0;
            }
          }
        }
        if (e.behavior === "brakeRaider") {
          if (e.brakeElapsed === undefined) {
            e.y = Math.min(145, e.y + e.speed * dt);
            if (e.y >= 145) e.brakeElapsed = 0;
          } else {
            e.brakeElapsed += dt;
            if (e.brakeElapsed > 0.75) e.y += e.speed * 1.15 * dt;
          }
        }
        if (e.behavior === "hookWing") {
          // One smooth in-and-out banking pass, mirrored for each entry side.
          e.x = Math.max(
            25,
            Math.min(
              this.stage.width - 25,
              (e.originX ?? e.x) +
                (e.direction ?? 1) *
                  65 *
                  Math.sin(Math.min(e.age / 2.7, 1) * Math.PI),
            ),
          );
        }
        if (e.behavior === "weave")
          e.x = Math.max(
            25,
            Math.min(
              this.stage.width - 25,
              (e.originX ?? e.x) + Math.sin(e.age * 2.6) * 38,
            ),
          );
        if (
          !ground &&
          e.behavior !== "gatekeeper" &&
          e.behavior !== "dive" &&
          e.behavior !== "brakeRaider" &&
          e.behavior !== "cross" &&
          e.behavior !== "carrier" &&
          !(
            (e.behavior === "turret" || e.behavior === "heavy") &&
            e.y >= 150 &&
            e.age < (e.behavior === "heavy" ? 8 : 6)
          )
        )
          e.y += e.speed * dt;
        if (
          !ground &&
          e.behavior !== "gatekeeper" &&
          !e.enteredPlayfield &&
          e.x >= 0 &&
          e.x <= this.stage.width &&
          e.y >= 80 &&
          e.y <= this.stage.height
        ) {
          e.enteredPlayfield = true;
          this.enteredAir++;
        }
        if (
          e.fireEvery &&
          (e.behavior !== "brakeRaider" ||
            (e.brakeElapsed !== undefined && (e.shotsFired ?? 0) < 2)) &&
          this.interactable(e) &&
          e.behavior !== "gatekeeper" &&
          e.behavior !== "escort" &&
          e.behavior !== "groundDepot" &&
          e.y > 40 &&
          e.y < 400
        ) {
          e.fireCooldown = (e.fireCooldown ?? e.fireEvery) - dt;
          if (e.behavior === "groundBattery") {
            const target =
              e.aimAngle ??
              Math.atan2(this.player.x - e.x, this.player.y - e.y);
            if (this.time >= (e.turretHoldUntil ?? 0))
              e.turretAngle = turnToward(e.turretAngle ?? 0, target, dt);
          }
          if (e.fireCooldown <= 0.6 && e.aimAngle === undefined)
            e.aimAngle = Math.atan2(this.player.x - e.x, this.player.y - e.y);
          if (e.behavior === "groundBattery" && e.aimAngle !== undefined) {
            // Lock the current barrel heading, never snap to a new target.
            if ((e.telegraph ?? 0) <= 0) e.aimAngle = e.turretAngle ?? 0;
            e.turretAngle = e.aimAngle;
          }
          e.telegraph =
            e.fireCooldown > 0 && e.fireCooldown <= 0.6 ? e.fireCooldown : 0;
          if (
            isFastShooter(e.behavior) &&
            e.fireCooldown <= 0.6 &&
            !e.attackAngles?.length
          )
            e.attackAngles =
              e.behavior === "brakeRaider"
                ? [e.aimAngle! - 0.18, e.aimAngle! + 0.18]
                : fastAttackAngles(e.behavior, e.shotsFired ?? 0, e.direction);
          if (
            e.behavior === "heavy" &&
            e.fireCooldown <= 0.6 &&
            !e.attackAngles?.length
          ) {
            const lean = (e.shotsFired ?? 0) % 2 ? 0.14 : -0.14;
            e.attackAngles = [-0.4, 0, 0.4].map((a) => a + lean);
          }
          if (e.fireCooldown <= 0) {
            const aim = e.aimAngle ?? 0;
            if (e.behavior === "turret" || e.behavior === "groundBattery") {
              if (e.behavior === "groundBattery")
                e.turretHoldUntil = this.time + 0.4;
              const muzzle =
                e.behavior === "groundBattery"
                  ? groundMuzzle(e, aim)
                  : { x: e.x, y: e.y + 20 };
              for (const a of [0])
                this.shootEnemy(
                  muzzle.x,
                  muzzle.y,
                  Math.sin(aim + a) * 145,
                  Math.cos(aim + a) * 145,
                  e,
                );
            } else if (e.behavior === "heavy") {
              for (const a of e.attackAngles ?? [-0.4, 0, 0.4])
                this.shootEnemy(
                  e.x,
                  e.y + 20,
                  Math.sin(a) * 135,
                  Math.cos(a) * 135,
                  e,
                );
            } else this.shootEnemy(e.x, e.y + 20, 0, 155, e);
            e.shotsFired = (e.shotsFired ?? 0) + 1;
            if (e.behavior === "groundBattery") this.groundShotCount++;
            e.fireCooldown = e.fireEvery;
            e.aimAngle = undefined;
            e.attackAngles = [];
          }
        }
        if (
          e.y > this.stage.height + 30 ||
          e.x < -50 ||
          e.x > this.stage.width + 50 ||
          e.y < -80
        )
          e.active = false;
      }
    if (this.boss?.active && this.stage.boss) {
      const boss = this.boss;
      boss.age += dt;
      boss.y = Math.min(105, boss.y + 100 * dt);
      const phase: 1 | 2 | 3 =
        boss.hp > boss.maxHp * 0.67 ? 1 : boss.hp > boss.maxHp * 0.34 ? 2 : 3;
      if (phase !== boss.phase) {
        boss.phase = phase;
        boss.telegraph = 1.2;
        boss.fireCooldown = 0.4;
        boss.attackAngles = [];
        boss.attackWarning = 0;
        // A clear transition instead of stacking the preceding phase's bullets.
        for (const b of this.enemyBullets) b.active = false;
        this.pendingShots = [];
      }
      boss.telegraph = Math.max(0, boss.telegraph - dt);
      boss.x =
        this.stage.width / 2 +
        Math.sin(boss.age * (phase === 3 ? 1.3 : 0.7)) *
          (phase === 1 ? 12 : phase === 2 ? 45 : 65);
      for (const part of boss.cannons) {
        part.x = boss.x + part.side * 68;
        part.y = boss.y + 20;
      }
      if (boss.y >= 105 && boss.telegraph <= 0) boss.fireCooldown -= dt;
      if (
        boss.y >= 105 &&
        boss.telegraph <= 0.65 &&
        boss.fireCooldown <= 0.65
      ) {
        if (!boss.attackAngles.length) {
          // Entry can finish after the phase banner; never shorten its first tell.
          boss.fireCooldown = Math.max(
            boss.fireCooldown,
            0.65 - boss.telegraph,
          );
          const aim = Math.atan2(
            this.player.x - boss.x,
            this.player.y - boss.y,
          );
          const sweep = boss.attackCycle % 2 ? 0.1 : -0.1;
          boss.attackAngles =
            phase === 1
              ? bossSideAngles(boss, this.player.x, this.player.y)
              : phase === 2
                ? [-0.5, -0.25, 0, 0.25, 0.5].map((a) => a + sweep)
                : [-0.3, 0, 0.3].map((a) => a + aim);
        }
        boss.attackWarning = Math.max(0, boss.telegraph + boss.fireCooldown);
      }
      if (boss.y >= 105 && boss.telegraph <= 0 && boss.fireCooldown <= 0) {
        const angles = boss.attackAngles;
        for (const [index, a] of angles.entries()) {
          const muzzle = bossMuzzle(boss, index, angles.length);
          if (!muzzle.active) continue;
          this.shootEnemy(
            muzzle.x,
            muzzle.y,
            Math.sin(a) * this.stage.boss.bulletSpeed,
            Math.cos(a) * this.stage.boss.bulletSpeed,
            boss,
            muzzle.cannon,
          );
        }
        boss.fireCooldown = this.stage.boss.fireEvery * (phase === 3 ? 0.7 : 1);
        boss.attackCycle++;
        boss.attackWarning = 0;
        boss.attackAngles = [];
      }
    }
    this.pendingShots = this.pendingShots.filter((shot) => {
      if (
        !shot.source.active ||
        shot.guard?.active === false ||
        ("id" in shot.source && shot.source.id !== shot.sourceId)
      )
        return false;
      if (shot.at > this.time + 1e-9) return true;
      this.emitEnemyBullet(
        shot.source.x + shot.x,
        shot.source.y + shot.y,
        shot.vx,
        shot.vy,
        shot.boss,
        shot.visual,
      );
      return false;
    });
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
          this.mode === "playing" &&
          p.active &&
          Math.hypot(p.x - this.player.x, p.y - this.player.y) < 26
        ) {
          p.active = false;
          this.lastPickup = p.kind;
          if (p.kind === "heal") this.hp = Math.min(3, this.hp + 1);
          else if (p.kind === "support") {
            this.supportTime = 8;
            this.supportCooldown = 0;
          } else {
            if (
              p.kind === "spread" ||
              p.kind === "beam" ||
              p.kind === "missile"
            )
              this.weaponMode = p.kind;
            this.weaponLevel = Math.min(3, this.weaponLevel + 1);
            this.weaponTime = 1;
          }
          this.pickupCount++;
          this.effects.push({ x: p.x, y: p.y, life: 0.45 });
        }
      }
    for (const b of this.bullets)
      if (b.active) {
        for (const e of this.enemies)
          if (
            e.active &&
            !b.hitIds?.includes(e.id) &&
            this.interactable(e) &&
            Math.abs(b.x - e.x) < 22 + (b.width ?? 0) / 2 &&
            Math.abs(b.y - e.y) < 25
          ) {
            (b.hitIds ??= []).push(e.id);
            b.pierceRemaining = (b.pierceRemaining ?? 1) - 1;
            if (b.pierceRemaining <= 0) b.active = false;
            e.hp -= b.damage ?? 1;
            this.effects.push({ x: b.x, y: b.y, life: 0.25, kind: "hit" });
            if (e.hp <= 0) this.destroyEnemy(e);
            if (!b.active) break;
          }
        const boss = this.boss;
        if (b.active && boss?.active)
          for (const part of boss.cannons) {
            if (!b.active) break;
            if (
              !part.active ||
              b.hitIds?.includes(part.id) ||
              Math.abs(b.x - part.x) >= 14 + (b.width ?? 0) / 2 ||
              Math.abs(b.y - part.y) >= 20
            )
              continue;
            (b.hitIds ??= []).push(part.id);
            b.pierceRemaining = (b.pierceRemaining ?? 1) - 1;
            if (b.pierceRemaining <= 0) b.active = false;
            part.hp -= b.damage ?? 1;
            this.effects.push({ x: b.x, y: b.y, life: 0.25, kind: "hit" });
            this.finishPart(part);
          }
        if (
          b.active &&
          boss?.active &&
          !b.hitIds?.includes(-1) &&
          Math.abs(b.x - boss.x) < 48 + (b.width ?? 0) / 2 &&
          Math.abs(b.y - boss.y) < 36
        ) {
          b.active = false;
          (b.hitIds ??= []).push(-1);
          boss.hp -= b.damage ?? 1;
          this.effects.push({ x: b.x, y: b.y, life: 0.25, kind: "hit" });
          this.finishBoss();
        }
      }
    for (const e of this.enemies)
      if (
        e.active &&
        e.behavior !== "groundBattery" &&
        e.behavior !== "groundDepot" &&
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
