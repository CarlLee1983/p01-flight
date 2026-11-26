import { expect, it } from "vitest";
import { FlightModel } from "../src/game/model";
import { stageConfig, STAGE_CATALOG } from "../src/game/stage-catalog";
import { nextStage, stageUnlocked } from "../src/game/stage-selection";
import { BrowserSaveRepository } from "../src/storage/save";
import { lateFrontDirection } from "./late-front-policy";
import { sustainedHit } from "../src/game/sustained-fire";
it("old campaign saves unlock Stage 04 but not Stage 05, and the finale is terminal", () => {
  const save = new BrowserSaveRepository(null).data;
  expect(stageUnlocked("stage-04", save)).toBe(false);
  save.stages["stage-03"] = { cleared: true, bestScore: 44321, clearCount: 1 };
  expect(stageUnlocked("stage-04", save)).toBe(true);
  expect(stageUnlocked("stage-05", save)).toBe(false);
  save.stages["stage-04"] = { cleared: true, bestScore: 55555, clearCount: 1 };
  expect(stageUnlocked("stage-05", save)).toBe(true);
  expect(STAGE_CATALOG.map((s) => s.id)).toEqual([
    "stage-01",
    "stage-02",
    "stage-03",
    "stage-04",
    "stage-05",
  ]);
  expect(nextStage("stage-05")).toBeNull();
});
it("only live lanes can hurt, and the visible inner width sets collision", () => {
  const ray = {
    x: 100,
    y: 160,
    width: 12,
    slope: 0.1,
    kind: "lance",
    state: "live",
    progress: 0.5,
  } as const;
  expect(sustainedHit(ray, 138, 540)).toBe(true);
  expect(sustainedHit(ray, 151, 540)).toBe(false);
  expect(sustainedHit(ray, 100, 120)).toBe(false);
  expect(sustainedHit({ ...ray, state: "charge" }, 138, 540)).toBe(false);
});
it.each([
  ["stage-04", 1, 30],
  ["stage-04", 42, 60],
  ["stage-05", 1, 30],
  ["stage-05", 42, 60],
] as const)("normal controls clear %s, seed %i, %i FPS", (id, seed, fps) => {
  const m = new FlightModel(stageConfig(id, seed));
  m.start();
  const phases = new Set<number>(),
    seen = new Set<string>();
  const bossAt = m.stage.boss!.at;
  while (m.mode === "playing" && m.time < m.stage.duration + 1) {
    const rays = m.sustainedFire;
    for (const r of rays)
      seen.add((m.boss?.active ? "boss-" : "mini-") + r.state);
    if (m.boss?.motion?.entered) phases.add(m.boss.phase);
    if (m.time >= bossAt + (m.bombs === 2 ? 12 : 19) && m.bombs > 0)
      m.useBomb();
    const dir = lateFrontDirection({
      player: m.player,
      activeEnemies: m.enemies.filter((e) => e.active),
      hostileProjectiles: m.enemyBullets.filter((e) => e.active),
      sustainedFire: rays,
      boss: m.boss,
    });
    m.update(1 / fps, dir, 0, m.time < bossAt || m.time > bossAt + 6);
  }
  expect({
    mode: m.mode,
    bossHp: m.boss?.hp,
    time: m.time,
    seen: [...seen],
  }).toMatchObject({ mode: "won", bossHp: 0 });
  expect(phases).toEqual(new Set([1, 2, 3]));
  expect([...seen]).toEqual(
    expect.arrayContaining(["boss-charge", "boss-live"]),
  );
});
