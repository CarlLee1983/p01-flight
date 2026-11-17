import { expect, it } from "vitest";
import type { Page } from "@playwright/test";
import { withKeyboardPilot } from "./e2e/gameplay";

it("continues real-key decisions while an evidence RPC is pending, and releases before returning", async () => {
  const events: string[] = [];
  let ticks = 0;
  let finish!: () => void;
  const work = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const page = {
    evaluate: async () => ({
      mode: "playing",
      player: { x: ticks < 2 ? 90 : 270, y: 540 },
      hostileProjectiles: [],
    }),
    keyboard: {
      down: async (key: string) => {
        events.push(`down:${key}`);
      },
      up: async (key: string) => {
        events.push(`up:${key}`);
      },
    },
    waitForTimeout: async () => {
      if (++ticks === 4) finish();
    },
  } as unknown as Page;
  await withKeyboardPilot(page, () => work);
  expect(ticks).toBe(4);
  expect(events).toEqual([
    "down:ArrowRight",
    "up:ArrowRight",
    "down:ArrowLeft",
    "up:ArrowLeft",
  ]);
});
it("does not swallow failed evidence collection or leave movement held", async () => {
  const events: string[] = [];
  let fail!: (e: Error) => void;
  const work = new Promise<void>((_, reject) => {
    fail = reject;
  });
  const page = {
    evaluate: async () => ({
      mode: "playing",
      player: { x: 90, y: 540 },
      hostileProjectiles: [],
    }),
    keyboard: {
      down: async (k: string) => {
        events.push(`down:${k}`);
      },
      up: async (k: string) => {
        events.push(`up:${k}`);
      },
    },
    waitForTimeout: async () => {
      fail(new Error("capture failed"));
    },
  } as unknown as Page;
  await expect(withKeyboardPilot(page, () => work)).rejects.toThrow(
    "capture failed",
  );
  expect(events).toEqual(["down:ArrowRight", "up:ArrowRight"]);
});
it("settles bounded evidence after pilot failure and preserves the pilot error", async () => {
  let finished = false;
  const page = {
    evaluate: async () => ({ mode: "lost" }),
    keyboard: { up: async () => {} },
  } as unknown as Page;
  const task = withKeyboardPilot(page, async () => {
    await new Promise((r) => setTimeout(r, 10));
    finished = true;
    throw new Error("secondary capture failure");
  });
  await expect(task).rejects.toThrow("playing");
  expect(finished).toBe(true);
});
