import { test, expect } from "@playwright/test";
import { state, withKeyboardPilot } from "./gameplay";
import { SAVE_KEY } from "../../src/storage/save";
test.use({ video: { mode: "on", size: { width: 500, height: 700 } } });

async function unlockStage02(page: import("@playwright/test").Page) {
  await page.addInitScript((key) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          saveVersion: 1,
          stages: {
            "stage-01": { cleared: true, bestScore: 2000, clearCount: 1 },
          },
          settings: { musicVolume: 0, sfxVolume: 0 },
        }),
      );
  }, SAVE_KEY);
  await page.goto("/?seed=42");
  await page.locator("#stage-select").selectOption("stage-02");
}
test("stage selection is locked for a new player", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator('#stage-select option[value="stage-02"]'),
  ).toBeDisabled();
  await expect(page.locator("#start")).toBeVisible();
});
test("Stage02 canyon, normal keyboard clear, retry seed and persisted record", async ({
  page,
}) => {
  test.setTimeout(660000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await unlockStage02(page);
  await page.screenshot({ path: "docs/stage02-menu.png" });
  await page.locator("#start").click();
  await page.keyboard.down("Space");
  let first = false,
    second = false;
  await withKeyboardPilot(page, async () => {
    let captured = false,
      bridge = false,
      mine = false,
      dam = false;
    const deadline = Date.now() + 550000;
    while (Date.now() < deadline) {
      const s = await state(page);
      if (s.mode !== "playing") {
        expect(s.mode).toBe("won");
        break;
      }
      if (s.time > 151 && !first) {
        await page.keyboard.press("x");
        first = true;
      }
      if (s.time > 158 && !second) {
        await page.keyboard.press("x");
        second = true;
      }
      if (s.time > 5 && !captured) {
        captured = true;
        expect(s.stageId).toBe("stage-02");
        expect(s.seed).toBe(42);
        expect(s.background.theme).toBe("canyon");
        await page.screenshot({ path: "docs/stage02-river.png" });
      }
      if (s.time > 31 && !bridge) {
        bridge = true;
        await page.screenshot({ path: "docs/stage02-bridge.png" });
      }
      if (s.time > 61 && !mine) {
        mine = true;
        await page.screenshot({ path: "docs/stage02-mine.png" });
      }
      if (s.time > 126 && !dam) {
        dam = true;
        await page.screenshot({ path: "docs/stage02-dam.png" });
      }
      await page.waitForTimeout(100);
    }
  });
  await page.keyboard.up("Space");
  await expect
    .poll(async () => (await state(page)).mode, { timeout: 10000 })
    .toBe("won");
  const done = await state(page);
  expect(done.bossDefeated).toBe(true);
  expect(done.save.stages["stage-02"].cleared).toBe(true);
  expect(done.save.stages["stage-01"].bestScore).toBe(2000);
  await page.screenshot({ path: "docs/stage02-clear.png" });
  await page.locator("#retry").click();
  expect((await state(page)).seed).toBe(42);
  expect((await state(page)).time).toBeLessThan(2);
  await page.locator("#menu").click();
  await page.reload();
  await page.locator("#stage-select").selectOption("stage-02");
  expect(
    (await state(page)).save.stages["stage-02"].clearCount,
  ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
test("Stage02 mobile selection, touch, pause, reset and retry preserve controls", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP touch uses Chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockStage02(page);
  await page.locator("#start").click();
  const box = await page.locator("canvas").boundingBox();
  expect(box).not.toBeNull();
  const cdp = await page.context().newCDPSession(page);
  const start = { x: box!.x + box!.width * 0.5, y: box!.y + box!.height * 0.8 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 0 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: start.x + 30, y: start.y, id: 0 }],
  });
  await page.waitForTimeout(600);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect((await state(page)).shots).toBeGreaterThan(0);
  await page.locator("#touch-pause").click();
  expect((await state(page)).mode).toBe("paused");
  await page.screenshot({ path: "docs/stage02-mobile.png" });
  await page.locator("#touch-pause").click();
  expect((await state(page)).mode).toBe("playing");
  await page.locator("#menu").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#reset").click();
  await expect(
    page.locator('#stage-select option[value="stage-02"]'),
  ).toBeDisabled();
  expect((await state(page)).stageId).toBe("stage-01");
});

test("Stage02 full CDP touch sortie clears and preserves its result", async ({
  browser,
}) => {
  test.setTimeout(660000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await unlockStage02(page);
    await page.locator("#start").click();
    const box = (await page.locator("canvas").boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const anchor = {
      x: box.x + box.width / 2,
      y: box.y + box.height * 0.8,
      id: 1,
    };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [anchor],
    });
    const { chooseTouchTarget } = await import("../touch-policy");
    const { touchDeliveryBudget } = await import("../touch-delivery-budget");
    let target = 180,
      budget = 0.2,
      bombs = 0;
    const deadline = Date.now() + 550000;
    while (Date.now() < deadline) {
      const s = await state(page);
      if (s.mode !== "playing") {
        expect(s.mode).toBe("won");
        break;
      }
      if ((s.time >= 151 && bombs === 0) || (s.time >= 158 && bombs === 1)) {
        const button = (await page.locator("#touch-bomb").boundingBox())!;
        const finger = {
          x: button.x + button.width / 2,
          y: button.y + button.height / 2,
          id: 2,
        };
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [anchor, finger],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [finger],
        });
        bombs++;
        const after = await state(page);
        if (after.mode === "won") break;
      }
      const next = chooseTouchTarget(s, target, budget);
      const changed = Math.abs(next - target) > 1;
      target = next;
      anchor.x = box.x + box.width / 2 + ((target - 180) * box.width) / 360;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [anchor],
      });
      const after = await state(page);
      budget = touchDeliveryBudget(
        budget,
        changed,
        Math.max(0, after.time - s.time),
      );
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () => (await state(page)).mode, { timeout: 10000 })
      .toBe("won");
    await expect
      .poll(async () => (await state(page)).save.stages["stage-02"]?.cleared)
      .toBe(true);
    await page.screenshot({ path: "docs/stage02-touch-clear.png" });
  } finally {
    await context.close();
  }
});

test("Stage02 failed sortie can restart with the same seed", async ({
  page,
}) => {
  test.setTimeout(300000);
  await unlockStage02(page);
  await page.locator("#start").click();
  // Normal no-fire/no-movement route: enemy damage, not a health setter.
  await expect
    .poll(async () => (await state(page)).mode, {
      timeout: 270000,
      intervals: [250],
    })
    .toBe("lost");
  const failed = await state(page);
  expect(failed.save.stages["stage-02"].cleared).toBe(false);
  await page.locator("#retry").click();
  const retry = await state(page);
  expect(retry.seed).toBe(42);
  expect(retry.hp).toBe(3);
  expect(retry.mode).toBe("playing");
  expect(retry.time).toBeLessThan(2);
});
