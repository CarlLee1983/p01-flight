import { describe, it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { BrowserSaveRepository, SAVE_KEY } from "../src/storage/save";
const advance = (m: FlightModel, seconds: number, fire = false) => {
  for (let i = 0; i < seconds * 60; i++) m.update(1 / 60, 0, 0, fire);
};
describe("flight rules", () => {
  it("normalizes diagonal movement and bounds player", () => {
    const a = new FlightModel(stage01),
      b = new FlightModel(stage01);
    a.start();
    b.start();
    a.update(0.05, 1, 0);
    b.update(0.05, 1, 1);
    expect(Math.hypot(b.player.x - 180, b.player.y - 540)).toBeCloseTo(
      a.player.x - 180,
    );
    for (let i = 0; i < 100; i++) a.update(0.05, 1, -1);
    expect(a.player.x).toBe(342);
    expect(a.player.y).toBe(70);
  });
  it("fire cooldown, pools, offscreen cleanup", () => {
    const m = new FlightModel({
      ...stage01,
      waves: [],
      boss: undefined,
      pickups: [],
    });
    m.start();
    advance(m, 10, true);
    expect(m.shots).toBeGreaterThan(60);
    expect(m.shots).toBeLessThan(115);
    expect(m.bullets.length).toBeLessThan(12);
    advance(m, 2);
    expect(m.bullets.some((b) => b.active)).toBe(false);
  });
  it("single hit scores once", () => {
    const m = new FlightModel({
      ...stage01,
      waves: [],
      boss: undefined,
      pickups: [],
    });
    m.start();
    m.enemies.push({
      id: 1,
      x: 180,
      y: 200,
      hp: 1,
      speed: 0,
      points: 100,
      active: true,
    });
    m.bullets.push(
      { id: 2, x: 180, y: 200, active: true },
      { id: 3, x: 180, y: 200, active: true },
    );
    m.update(0);
    expect(m.score).toBe(100);
  });
  it("invulnerability prevents overlap killing instantly", () => {
    const m = new FlightModel({
      ...stage01,
      waves: [],
      boss: undefined,
      pickups: [],
    });
    m.start();
    for (let i = 0; i < 3; i++)
      m.enemies.push({
        id: i,
        x: 180,
        y: 540,
        hp: 1,
        speed: 0,
        points: 100,
        active: true,
      });
    m.update(0);
    expect(m.hp).toBe(2);
    m.update(0.05);
    expect(m.hp).toBe(2);
  });
  it("wins at configured deadline and restart resets all state", () => {
    const m = new FlightModel({
      ...stage01,
      waves: [],
      boss: undefined,
      pickups: [],
    });
    m.start();
    advance(m, 171);
    expect(m.mode).toBe("won");
    expect(m.time).toBe(170);
    for (let i = 0; i < 10; i++) {
      m.start();
      advance(m, 1, true);
    }
    expect(m.score).toBe(0);
    expect(m.hp).toBe(3);
    expect(m.bullets.length).toBeLessThan(10);
  });
  it("loses on third distinct hit; paused time is frozen", () => {
    const m = new FlightModel({
      ...stage01,
      waves: [],
      boss: undefined,
      pickups: [],
    });
    m.start();
    m.pause();
    advance(m, 5);
    expect(m.time).toBe(0);
    m.pause();
    for (let i = 0; i < 3; i++) {
      m.invincible = 0;
      m.enemies.push({
        id: i,
        x: m.player.x,
        y: m.player.y,
        hp: 1,
        speed: 0,
        points: 1,
        active: true,
      });
      m.update(0);
    }
    expect(m.mode).toBe("lost");
  });
});
describe("save repository", () => {
  const memory = () => {
    let value: string | null = null;
    return {
      getItem: () => value,
      setItem: (_k: string, v: string) => {
        value = v;
      },
    };
  };
  it("preserves best score, progress/settings across instances", () => {
    const s = memory(),
      a = new BrowserSaveRepository(s);
    a.record("stage-01", 500, true);
    a.record("stage-01", 100, false);
    a.settings(0.2, 0.3);
    const b = new BrowserSaveRepository(s);
    expect(b.data.stages["stage-01"]).toEqual({
      bestScore: 500,
      cleared: true,
      clearCount: 1,
    });
    expect(b.data.settings.musicVolume).toBe(0.2);
  });
  it.each([
    "bad",
    '{"saveVersion":2}',
    '{"saveVersion":1,"stages":{},"settings":{"musicVolume":2,"sfxVolume":0}}',
  ])("handles corrupt/version incompatible data %s", (raw) => {
    const s = memory();
    s.setItem(SAVE_KEY, raw);
    const a = new BrowserSaveRepository(s);
    expect(a.warning).not.toBe("");
    expect(a.data.saveVersion).toBe(1);
  });
  it("storage blocked allows play with warning", () => {
    const a = new BrowserSaveRepository({
      getItem: () => null,
      setItem: () => {
        throw Error("blocked");
      },
    });
    a.record("stage-01", 300, true);
    expect(a.data.stages["stage-01"].bestScore).toBe(300);
    expect(a.warning).toContain("未能保存");
  });
});
describe("Stage 01 playthrough fixtures", () => {
  it("can win using normal input and score without changing rules", () => {
    const m = new FlightModel(stage01);
    m.start();
    let bomb1 = false,
      bomb2 = false;
    for (let i = 0; i < 171 * 60; i++) {
      if (!bomb1 && m.time >= 140) bomb1 = m.useBomb();
      if (!bomb2 && m.time >= 146) bomb2 = m.useBomb();
      m.update(1 / 60, 0, 0, true);
    }
    expect(m.mode).toBe("won");
    expect(m.hp).toBeGreaterThan(0);
    expect(m.score).toBeGreaterThan(0);
  });
  it("idle pilot can naturally lose", () => {
    const m = new FlightModel(stage01);
    m.start();
    advance(m, 60);
    expect(m.mode).toBe("lost");
  });
});
