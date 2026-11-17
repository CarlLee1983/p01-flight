import { it, expect } from "vitest";
import { FlightModel } from "../src/game/model";
import { stage01 } from "../src/data/stage";
import { dodgeDirection } from "./dodge-route";
it("normal firing distinguishes compact hits from destroyed-unit bursts", () => {
  const m = new FlightModel(stage01);
  m.start();
  let hits = 0,
    bursts = 0;
  for (let i = 0; i < 60 * 65 && m.mode === "playing"; i++) {
    m.update(1 / 60, dodgeDirection(m, 0), 0, true);
    hits += m.effects.filter((e) => e.kind === "hit").length;
    bursts += m.effects.filter((e) => e.kind === undefined).length;
  }
  expect(hits).toBeGreaterThan(0);
  expect(bursts).toBeGreaterThan(0);
  expect(m.killCount).toBeGreaterThan(0);
});
