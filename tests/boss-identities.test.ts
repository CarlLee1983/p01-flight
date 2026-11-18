import { describe, it, expect } from "vitest";
import {
  bossRig,
  bossPose,
  bossMount,
  bossPartBudget,
  bossPartContains,
  bossCoreContains,
  type BossSkin,
} from "../src/game/boss-rigs";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { resolveBossRay } from "../src/game/boss-muzzles";
import { bossAttackPlan } from "../src/game/boss-attacks";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assets from "../docs/boss-identities-assets.json";
const skins: BossSkin[] = ["command", "riverFortress", "polarRadar"];
it("three rigs have different structures, textures and conserved armour rewards", () => {
  expect(skins.map((s) => bossRig(s).partCount)).toEqual([2, 3, 4]);
  expect(new Set(skins.map((s) => bossRig(s).key)).size).toBe(3);
  for (const skin of skins)
    for (const hp of [24, 28]) {
      const budget = bossPartBudget(skin, hp);
      expect(budget.reduce((a, p) => a + p.hp, 0)).toBe(hp * 2);
      expect(budget.reduce((a, p) => a + p.breakDamage, 0)).toBe(24);
      expect(budget.reduce((a, p) => a + p.points, 0)).toBe(500);
    }
  for (const a of assets) {
    const b = readFileSync("public/assets/original/" + a.key + ".webp");
    expect(createHash("sha256").update(b).digest("hex")).toBe(a.sha256);
    expect(b.length).toBeLessThan(250000);
  }
});
describe.each(skins)("%s rig", (skin) => {
  it.each([30, 60, 120])(
    "continuous finite poses and complete mounts at %i FPS",
    (fps) => {
      for (const phase of [1, 2, 3] as const) {
        let previous = bossPose(skin, 0, phase),
          moving = 0,
          resting = 0,
          maxStep = 0,
          minX = Infinity,
          maxX = -Infinity,
          minMount = Infinity,
          maxMount = -Infinity,
          finite = true;
        for (let frame = 1; frame < 20 * fps; frame++) {
          const p = bossPose(skin, frame / fps, phase);
          finite &&= Object.values(p).every(
            (v) => typeof v !== "number" || Number.isFinite(v),
          );
          maxStep = Math.max(
            maxStep,
            Math.hypot(p.x - previous.x, p.y - previous.y),
          );
          if (p.entered) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            if (p.canFire) resting++;
            else moving++;
          }
          for (let i = 0; i < bossRig(skin).partCount; i++) {
            const m = bossMount(skin, i, p);
            minMount = Math.min(minMount, m.x);
            maxMount = Math.max(maxMount, m.x);
            finite &&= bossPartContains({ skin }, { ...m }, m.x, m.y);
          }
          previous = p;
        }
        expect(finite).toBe(true);
        expect(maxStep).toBeLessThan(280 / fps);
        expect(minX).toBeGreaterThan(100);
        expect(maxX).toBeLessThan(260);
        expect(minMount).toBeGreaterThan(15);
        expect(maxMount).toBeLessThan(345);
        expect(resting).toBeGreaterThan(0);
        if (skin !== "command" || phase === 3)
          expect(moving).toBeGreaterThan(0);
      }
    },
  );
  it("all phases warn locally, fire from live mounts, and cancel destroyed sources", () => {
    const m = new FlightModel({
      ...stage01,
      duration: 120,
      waves: [],
      pickups: [],
      boss: { ...stage01.boss!, skin, at: 0 },
    });
    m.start();
    m.invincible = 120; // Isolated outgoing geometry, not a victory proof.
    for (const phase of [1, 2, 3] as const) {
      m.boss ?? m.update(1 / 60);
      const boss = m.boss!;
      boss.hp = boss.maxHp * (phase === 1 ? 1 : phase === 2 ? 0.5 : 0.2);
      let planned = false,
        emitted = false;
      for (let frame = 0; frame < 15 * 60; frame++) {
        const count = m.emittedBossShots;
        m.update(1 / 60);
        if (boss.attackWarning > 0) {
          planned = true;
          expect(boss.attackPlan!.length).toBeGreaterThan(0);
        }
        if (m.emittedBossShots > count) {
          expect(planned).toBe(true);
          emitted = true;
          break;
        }
      }
      expect(emitted).toBe(true);
      for (const ray of bossAttackPlan(boss, m.player)) {
        const p = resolveBossRay(boss, ray);
        expect(Number.isFinite(p.x + p.y + p.angle)).toBe(true);
        if (ray.mount !== null) {
          const part = boss.cannons[ray.mount];
          part.active = false;
          expect(resolveBossRay(boss, ray).active).toBe(false);
          part.active = true;
        }
      }
    }
  });
});
it("river bridge can be hit without treating the whole hull as a core shield", () => {
  const b = { skin: "riverFortress" as const, x: 180, y: 185, roll: 0 };
  expect(bossCoreContains(b, 180, 117)).toBe(true);
  expect(bossCoreContains(b, 180, 220)).toBe(false);
});
