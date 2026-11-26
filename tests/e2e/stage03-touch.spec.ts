import { bossAimGoal } from "../boss-counterplay";
import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { state } from "./gameplay";
import { chooseThirdFront } from "./next-fronts-helpers";
import { chooseTouchTarget } from "../touch-policy";
import { VisibleHullTracker } from "../visible-hull-policy";
import { touchDeliveryBudget } from "../touch-delivery-budget";
test("polar front completes with CDP touch, rotates and retains records after browser close/reopen", async ({}, info) => {
  test.setTimeout(660000);
  const profile = await mkdtemp(tmpdir() + "/p01-polar-profile-");
  let context = await chromium.launchPersistentContext(profile, {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: info.outputPath("polar-touch-video"),
      size: { width: 390, height: 844 },
    },
  });
  let page = context.pages()[0] ?? (await context.newPage());
  try {
    await chooseThirdFront(page);
    await page.locator("#start").click();
    let box = (await page.locator("canvas").boundingBox())!;
    const cdp = await context.newCDPSession(page);
    let anchor = {
      x: box.x + box.width / 2,
      y: box.y + box.height * 0.8,
      id: 1,
    };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [anchor],
    });
    const hulls = new VisibleHullTracker();
    let target = 180,
      budget = 0.2,
      bombs = 0,
      rotated = false;
    const deadline = Date.now() + 550000;
    while (Date.now() < deadline) {
      let s = await state(page);
      if (s.mode !== "playing") {
        expect(s.mode).toBe("won");
        break;
      }
      if (s.time > 15 && !rotated) {
        rotated = true;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await page.setViewportSize({ width: 844, height: 390 });
        await expect
          .poll(async () => (await state(page)).touchTarget)
          .toBeFalsy();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({ path: "docs/stage03-touch-landscape.png" });
        await page.setViewportSize({ width: 390, height: 844 });
        box = (await page.locator("canvas").boundingBox())!;
        s = await state(page);
        target = s.player.x;
        budget = 0.2;
        anchor = {
          x: box.x + (s.player.x * box.width) / 360,
          y: box.y + box.height * 0.8,
          id: 1,
        };
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [anchor],
        });
      }
      if ((s.time >= 161 && bombs === 0) || (s.time >= 168 && bombs === 1)) {
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
        s = await state(page);
        if (s.mode === "won") break;
      }
      const hazards = hulls.observe(s.time, s.activeEnemies);
      const next = chooseTouchTarget(
          { ...s, hostileProjectiles: [...s.hostileProjectiles, ...hazards] },
          target,
          budget,
          bossAimGoal(s.boss, s.player.x),
        ),
        changed = Math.abs(next - target) > 1;
      target = next;
      anchor.x = box.x + (target * box.width) / 360;
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
    const stored = structuredClone((await state(page)).save);
    expect(stored.stages["stage-03"].cleared).toBe(true);
    expect(stored.stages["stage-03"].clearCount).toBe(1);
    expect(stored.stages["stage-02"].bestScore).toBe(5000);
    await page.screenshot({ path: "docs/stage03-touch-clear.png" });
    await context.close();
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      executablePath: process.env.CHROMIUM_PATH,
    });
    page = context.pages()[0] ?? (await context.newPage());
    await page.goto("http://127.0.0.1:4173/");
    await page.locator("#stage-select").selectOption("stage-03");
    expect((await state(page)).save).toEqual(stored);
    await page.screenshot({ path: "docs/stage03-browser-reopened.png" });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
