import { describe, it, expect } from "vitest";
import { createStage02, STAGE02_WINDOWS } from "../src/data/stage02";
import { stageUnlocked, nextStage } from "../src/game/stage-selection";
import { BrowserSaveRepository } from "../src/storage/save";
import { FlightModel } from "../src/game/model";
import { advanceFrame } from "../src/game/frame-step";
import { chooseAction, type Steering } from "./keyboard-policy";

describe("Stage02 seeded formations", () => {
  it("reproduces a seed but changes formation sides, roles and timings across seeds", () => {
    expect(createStage02(42)).toEqual(createStage02(42));
    expect(createStage02(42).waves).not.toEqual(createStage02(43).waves);
  });
  it.each(Array.from({ length: 32 }, (_, i) => i))(
    "seed %i keeps geometry, density and rest bounds",
    (seed) => {
      const s = createStage02(seed);
      let last = -1;
      for (const w of s.waves) {
        expect(w.at).toBeGreaterThanOrEqual(last);
        last = w.at;
        expect(Number.isFinite(w.x + w.speed + w.hp)).toBe(true);
        expect(w.x).toBeGreaterThanOrEqual(-30);
        expect(w.x).toBeLessThanOrEqual(390);
        expect(w.at).toBeLessThan(s.boss!.at);
        if (
          ["straight", "weave", "hookWing", "brakeRaider"].includes(w.behavior!)
        ) {
          expect(w.x).toBeGreaterThanOrEqual(35);
          expect(w.x).toBeLessThanOrEqual(325);
          expect(w.spawnY).toBeUndefined();
        }
      }
      const air = s.waves.filter(
        (w) =>
          !["groundBattery", "groundDepot", "gatekeeper", "carrier"].includes(
            w.behavior!,
          ),
      );
      expect(air.length).toBeGreaterThan(280);
      // No more than twelve combat aircraft enter in any one second, preserving gaps.
      for (let t = 0; t < 145; t += 0.25)
        expect(
          air.filter((w) => w.at >= t && w.at < t + 1).length,
        ).toBeLessThanOrEqual(12);
      for (const [from, to] of [
        [84, 92],
        [138, 145],
      ])
        expect(air.filter((w) => w.at >= from && w.at < to)).toHaveLength(0);
      expect(s.pickups).toEqual(createStage02(999).pickups);
      expect(s.sections).toEqual(createStage02(999).sections);
      expect(
        s.waves.filter((w) => w.behavior === "groundBattery"),
      ).toHaveLength(7);
      expect(STAGE02_WINDOWS).toHaveLength(5);
    },
  );
  it("unlocks only after Stage01 completion and preserves separate stage scores", () => {
    const data = new Map<string, string>();
    const port = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    };
    const repo = new BrowserSaveRepository(port);
    expect(stageUnlocked("stage-02", repo.data)).toBe(false);
    repo.record("stage-01", 1000, false);
    expect(stageUnlocked("stage-02", repo.data)).toBe(false);
    repo.record("stage-01", 2000, true);
    expect(stageUnlocked("stage-02", repo.data)).toBe(true);
    repo.record("stage-02", 3000, true);
    const reloaded = new BrowserSaveRepository(port);
    expect(reloaded.data.stages["stage-01"].bestScore).toBe(2000);
    expect(reloaded.data.stages["stage-02"].clearCount).toBe(1);
    expect(nextStage("stage-02")).toBe(null);
  });
});
it.each([1, 2, 3, 4, 5, 42, 99, 2026])(
  "normal inputs finish stage02 seed %i",
  (seed) => {
    const m = new FlightModel(createStage02(seed));
    m.start();
    let held: Steering = 0,
      next = 0,
      peak = 0;
    let bomb1 = false,
      bomb2 = false;
    for (let i = 0; i < 190 * 60 && m.mode === "playing"; i++) {
      if ((m.time >= 151 || (m.hp === 1 && m.invincible <= 0)) && !bomb1)
        bomb1 = m.useBomb();
      if (
        (m.time >= 158 ||
          (bomb1 &&
            m.hp === 1 &&
            m.invincible <= 0 &&
            m.enemyBullets.some((b) => b.active && b.y > 450))) &&
        !bomb2
      )
        bomb2 = m.useBomb();
      if (m.time >= next) {
        held = chooseAction(
          {
            player: m.player,
            hostileProjectiles: [
              ...m.enemyBullets.filter((b) => b.active),
              ...m.enemies
                .filter(
                  (e) =>
                    e.active &&
                    ![
                      "groundBattery",
                      "groundDepot",
                      "carrier",
                      "gatekeeper",
                    ].includes(e.behavior!),
                )
                .flatMap((e) =>
                  [-18, 0, 18].map((offset) => ({
                    x: e.x + offset,
                    y: e.y,
                    vx:
                      e.behavior === "cross" ? (e.direction ?? 1) * e.speed : 0,
                    vy: e.behavior === "cross" ? 0 : e.speed,
                  })),
                ),
            ],
          },
          held,
        );
        next = m.time + 0.1;
      }
      advanceFrame(m, 1 / 60, held, 0, true, false);
      peak = Math.max(peak, m.enemies.filter((e) => e.active).length);
    }
    console.log({
      seed,
      mode: m.mode,
      hp: m.hp,
      time: m.time,
      peak,
      entered: m.enteredAir,
    });
    expect(m.mode).toBe("won");
    expect(m.bossDefeated).toBe(true);
    expect(peak).toBeLessThan(40);
  },
);
