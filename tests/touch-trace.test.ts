import { expect, it } from "vitest";
import { TouchTrace } from "./touch-trace";
it("bounds input and damage history while retaining most recent failure evidence", () => {
  const trace = new TouchTrace();
  for (let i = 0; i < 1000; i++) trace.record({ time: i, hp: i % 2 ? 2 : 3 });
  expect(trace.samples).toHaveLength(96);
  expect(trace.damage).toHaveLength(16);
  expect(trace.samples[0].time).toBe(904);
  expect(trace.damage.at(-1)?.time).toBe(999);
  expect(JSON.parse(trace.json()).samples).toHaveLength(96);
});
