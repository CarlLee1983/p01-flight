import { it, expect } from "vitest";
import { touchDeliveryBudget } from "./touch-delivery-budget";
it("retains changed-command peak across cheap unchanged dispatches", () => {
  let b = touchDeliveryBudget(0.2, true, 0.24);
  expect(b).toBe(0.3);
  for (let i = 0; i < 20; i++) b = touchDeliveryBudget(b, false, 0.05);
  expect(b).toBe(0.3);
  expect(touchDeliveryBudget(b, true, 0.1)).toBe(0.3);
});
it("keeps the existing ceiling and rejects invalid timing", () => {
  expect(touchDeliveryBudget(0.2, true, 0.45)).toBe(0.3);
  expect(touchDeliveryBudget(0.2, true, NaN)).toBe(0.2);
});
