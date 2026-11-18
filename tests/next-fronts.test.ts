import { bossAimGoal } from "./boss-counterplay";
import { describe, it, expect } from "vitest";
import { createStage03, STAGE03_REST } from "../src/data/stage03";
import { createStage02 } from "../src/data/stage02";
import { FlightModel } from "../src/game/model";
import { advanceFrame } from "../src/game/frame-step";
import { isGroundRole } from "../src/game/enemy-roles";
import { bossVisual } from "../src/game/boss-visual";
import { groundMuzzle, hostileStyle } from "../src/game/hostile-visuals";
import { stageUnlocked, nextStage } from "../src/game/stage-selection";
import { stageConfig } from "../src/game/stage-catalog";
import { BrowserSaveRepository, SAVE_KEY } from "../src/storage/save";
import { polarLayout } from "../src/game/canyon-background";
import { VisibleHullTracker } from "./visible-hull-policy";
import { chooseAction, type Steering } from "./keyboard-policy";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sources from "../docs/next-fronts-art-sources.json";

describe("next-fronts contracts", () => {
  it("uses independent core silhouettes and original immutable bitmap imports", () => {
    expect(
      new Set([
        bossVisual().key,
        bossVisual("riverFortress").key,
        bossVisual("polarRadar").key,
      ]).size,
    ).toBe(3);
    for (const source of sources) {
      const bytes = readFileSync("public/" + source.path);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        source.sha256,
      );
      expect(source.bytes).toBeLessThan(500000);
    }
    expect(sources.reduce((sum, a) => sum + a.bytes, 0)).toBeLessThan(1800000);
  });
  it("keeps v1 records and unlocks the third front only after the second", () => {
    const data = new Map<string, string>();
    const port = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const saves = new BrowserSaveRepository(port);
    saves.record("stage-01", 2000, true);
    expect(stageUnlocked("stage-02", saves.data)).toBe(true);
    expect(stageUnlocked("stage-03", saves.data)).toBe(false);
    saves.record("stage-02", 5000, true);
    expect(stageUnlocked("stage-03", saves.data)).toBe(true);
    saves.record("stage-03", 7000, true);
    expect(new BrowserSaveRepository(port).data.stages).toEqual(
      saves.data.stages,
    );
    expect(data.has(SAVE_KEY)).toBe(true);
    expect(nextStage("stage-02")).toBe("stage-03");
    expect(nextStage("stage-03")).toBe(null);
    expect(stageConfig("stage-03", 42)).toEqual(createStage03(42));
  });
  it.each(Array.from({ length: 32 }, (_, i) => i))(
    "seed %i retains density/recovery/entry bounds and mandatory supplies",
    (seed) => {
      const s = createStage03(seed);
      expect(s).toEqual(createStage03(seed));
      expect(s.waves).not.toEqual(createStage03(seed + 1).waves);
      let last = 0;
      for (const wave of s.waves) {
        expect(wave.at).toBeGreaterThanOrEqual(last);
        last = wave.at;
        expect(wave.at).toBeLessThan(s.boss!.at);
        expect(Number.isFinite(wave.x + wave.speed + wave.hp)).toBe(true);
        expect(wave.x).toBeGreaterThanOrEqual(-30);
        expect(wave.x).toBeLessThanOrEqual(390);
      }
      const air = s.waves.filter(
        (w) => !isGroundRole(w.behavior) && w.behavior !== "carrier",
      );
      for (const [from, to] of STAGE03_REST)
        expect(air.filter((w) => w.at >= from && w.at < to)).toHaveLength(0);
      for (let t = 0; t < 155; t += 0.25)
        expect(
          air.filter((w) => w.at >= t && w.at < t + 1).length,
        ).toBeLessThanOrEqual(12);
      for (const role of ["outrider", "bomber", "missileTruck", "flakBattery"])
        expect(s.waves.some((w) => w.behavior === role)).toBe(true);
      expect(s.pickups).toEqual(createStage03(999).pickups);
      expect(
        s.waves
          .filter((w) => w.behavior === "outrider")
          .every((w) => w.x === -30 || w.x === 390),
      ).toBe(true);
    },
  );
  it("polar tiles cover the viewport and finish opening before Boss entry", () => {
    for (let t = 0; t < 205; t += 0.2) {
      const a = polarLayout(t);
      expect(a.tileY[0]).toBeLessThanOrEqual(0);
      expect(a.tileY[2] + 450).toBeGreaterThanOrEqual(640);
      expect(a.basinMix).toBeGreaterThanOrEqual(0);
      expect(a.basinMix).toBeLessThanOrEqual(1);
    }
    expect(polarLayout(145).basinMix).toBe(0);
    expect(polarLayout(155).basinMix).toBe(1);
  });
});

it.each(["missileTruck", "flakBattery"] as const)(
  "%s fires from its rotating physical barrels and remains a ground target",
  (role) => {
    const m = new FlightModel({
      id: "role-test",
      title: "test",
      width: 360,
      height: 640,
      duration: 20,
      enemyBurstShots: 2,
      waves: [
        {
          at: 0,
          x: 55,
          spawnY: 120,
          speed: 32,
          hp: 20,
          points: 1,
          behavior: role,
          fireEvery: 2.8,
          firstFireDelay: 1.4,
        },
      ],
    });
    m.start();
    for (let i = 0; i < 180 && !m.enemies[0]?.shotsFired; i++)
      advanceFrame(m, 1 / 60, 0, 0, false, false);
    const e = m.enemies[0],
      shots = m.enemyBullets.filter((b) => b.active);
    expect(e.shotsFired).toBe(1);
    expect(shots).toHaveLength(role === "flakBattery" ? 4 : 2);
    expect(m.spawnedAir).toBe(0);
    expect(m.enteredAir).toBe(0);
    const sockets = [-5, 5].map((side) =>
      groundMuzzle(e, e.turretAngle!, side),
    );
    for (const b of shots)
      expect(
        sockets.some(
          (s) =>
            Math.abs(s.x - b.muzzleX!) < 0.001 &&
            Math.abs(s.y - b.muzzleY!) < 0.001,
        ),
      ).toBe(true);
    expect(new Set(shots.map((b) => b.vx.toFixed(3))).size).toBe(shots.length);
    expect(shots.every((b) => b.visual === hostileStyle(false, role))).toBe(
      true,
    );
    const snapshot = { ...e };
    m.player = { x: e.x, y: e.y };
    m.invincible = 0;
    const hp = m.hp;
    advanceFrame(m, 1 / 60, 0, 0, false, false);
    expect(e.active).toBe(snapshot.active);
    expect(m.hp).toBe(hp);
  },
);
it("raider makes a real diagonal pass while bomber cruises and leaves a divergent slow fan", () => {
  for (const role of ["outrider", "bomber"] as const) {
    const m = new FlightModel({
      id: "role-test",
      title: "test",
      width: 360,
      height: 640,
      duration: 20,
      enemyBurstShots: 2,
      waves: [
        {
          at: 0,
          x: 100,
          spawnY: 120,
          speed: role === "outrider" ? 170 : 55,
          hp: 20,
          points: 1,
          behavior: role,
          direction: 1,
          fireEvery: 2.4,
          firstFireDelay: 0.8,
        },
      ],
    });
    m.start();
    for (let i = 0; i < 61; i++) advanceFrame(m, 1 / 60, 0, 0, false, false);
    const e = m.enemies[0];
    expect(e.x).not.toBe(100);
    expect(e.y).toBeGreaterThan(150);
    expect(e.shotsFired).toBeGreaterThan(0);
    expect(
      m.enemyBullets.filter((b) => b.active).length,
    ).toBeGreaterThanOrEqual(role === "bomber" ? 4 : 2);
  }
});

it.each([
  ...[1, 2, 3, 42, 99, 2026].map((seed) => [seed, 60]),
  [1, 30],
  [42, 30],
])(
  "Stage03 seed %i has a normal observed-input route at %i FPS",
  (seed, fps) => {
    const m = new FlightModel(createStage03(seed));
    m.start();
    const tracker = new VisibleHullTracker();
    let held: Steering = 0,
      next = 0,
      bombs = 0,
      peak = 0;
    for (let i = 0; i < 205 * fps && m.mode === "playing"; i++) {
      if ((m.time >= 161 && bombs === 0) || (m.time >= 168 && bombs === 1)) {
        if (m.useBomb()) bombs++;
      }
      if (m.time >= next) {
        const hulls = tracker.observe(
          m.time,
          m.enemies.filter((e) => e.active),
        );
        held = chooseAction(
          {
            player: m.player,
            hostileProjectiles: [
              ...m.enemyBullets.filter((b) => b.active),
              ...hulls,
            ],
          },
          held,
          bossAimGoal(m.boss, m.player.x),
        );
        next = m.time + 0.08;
      }
      advanceFrame(m, 1 / fps, held, 0, true, false);
      peak = Math.max(peak, m.enemies.filter((e) => e.active).length);
    }
    console.log("STAGE03_MODEL_ROUTE", {
      seed,
      mode: m.mode,
      hp: m.hp,
      time: m.time,
      peak,
      score: m.score,
    });
    expect(m.mode).toBe("won");
    expect(m.bossDefeated).toBe(true);
    expect(peak).toBeLessThan(40);
  },
);

it("new asset diagnostics remain readable before any Phaser missing texture exists", async () => {
  const { nextAssetStatus, NEXT_ASSETS } = await import(
    "../src/game/next-assets"
  );
  const status = nextAssetStatus({
    exists: () => false,
    get: () => {
      throw Error("unexpected unready texture read");
    },
  });
  expect(status).toHaveLength(NEXT_ASSETS.length);
  expect(status.every((a) => !a.ready && !a.bitmap)).toBe(true);
});

it("places the final polar supply on water and clears surface metadata on pool reuse", () => {
  const stage = createStage03(42);
  expect(
    stage.waves
      .filter((w) => w.behavior === "groundDepot")
      .map((w) => [w.at, w.groundSurface]),
  ).toEqual([
    [51, "land"],
    [109, "land"],
    [146, "water"],
  ]);
  const model = new FlightModel({
    ...stage,
    boss: undefined,
    waves: [
      {
        at: 0,
        x: 58,
        spawnY: 90,
        speed: 32,
        hp: 5,
        points: 250,
        behavior: "groundDepot",
        groundSurface: "water",
      },
      {
        at: 1,
        x: 58,
        spawnY: 90,
        speed: 32,
        hp: 5,
        points: 250,
        behavior: "groundDepot",
      },
    ],
  });
  model.start();
  model.update(0.01, 0, 0, false);
  const first = model.enemies.find((e) => e.active)!;
  expect(first.groundSurface).toBe("water");
  first.active = false;
  for (let i = 0; i < 65; i++) model.update(1 / 60, 0, 0, false);
  const reused = model.enemies.find((e) => e.active)!;
  expect(reused).toBe(first);
  expect(reused.groundSurface).toBeUndefined();
});
