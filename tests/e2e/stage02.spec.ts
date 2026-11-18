import { test, expect } from "@playwright/test";
import { state, withKeyboardPilot, waitGameTime } from "./gameplay";
import {
  installStage02Sampler,
  saveStage02Sampler,
  captureStage02Frame,
} from "./stage02-render-evidence";
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
}, testInfo) => {
  test.setTimeout(660000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installStage02Sampler(page);
  await unlockStage02(page);
  await page.screenshot({ path: "docs/stage02-menu.png" });
  await page.locator("#start").click();
  expect((await state(page)).metalSprites.every((a: any) => a.ready && a.bitmap)).toBe(true);
  await page.keyboard.down("Space");
  const roleFrames: {role: string; id: number; requestedGameTime: number; completedGameTime: number; file: string}[] = [];
  const photographed = new Set<string>();
  let first = false,
    second = false,
    observingBossEntry = false,
    brokenCaptured = false;
  await withKeyboardPilot(page, async () => {
    let captured = false,
      bridge = false,
      mine = false,
      dam = false,
      bossCaptured = false;
    const deadline = Date.now() + 550000;
    while (Date.now() < deadline) {
      const s = await state(page);
      if (s.mode !== "playing") {
        expect(s.mode).toBe("won");
        break;
      }
      const actor = s.activeEnemies.find((e: any) => !photographed.has(e.behavior) && e.y >= 112 && e.y <= 400 && e.x >= 20 && e.x <= 340);
      if (actor) {
        photographed.add(actor.behavior);
        const file = `docs/stage02-role-${actor.behavior}.png`;
        await page.screenshot({path: file, timeout: 15000});
        roleFrames.push({role: actor.behavior, id: actor.id, requestedGameTime: s.time, completedGameTime: (await state(page)).time, file});
      }
      // Ordinary fire release makes the intact hull inspectable. Movement and
      // enemy damage continue normally, no pause/health/time mutation is used.
      if (s.time >= 144 && !observingBossEntry) {
        await page.keyboard.up("Space");
        observingBossEntry = true;
      }
      if (s.time >= 146.8 && s.boss?.active && !bossCaptured) {
        expect(s.boss.cannons.filter((c: any) => c.active)).toHaveLength(2);
        bossCaptured = true;
        // The parallel keyboard pilot continues ordinary steering during captures.
        await captureStage02Frame(page, "stage02-boss-desktop");
        await page.setViewportSize({ width: 320, height: 700 });
        const narrow = await state(page);
        expect(narrow.boss?.active).toBe(true);
        if (narrow.pickupNoticeBounds) expect(narrow.pickupNoticeBounds.bottom).toBeLessThanOrEqual(72);
        await captureStage02Frame(page, "stage02-boss-320");
        await page.setViewportSize({ width: 1000, height: 900 });
        await page.keyboard.down("Space");
      }
      if (s.boss?.active && s.boss.cannons.some((c: any) => !c.active) && !brokenCaptured) {
        brokenCaptured = true;
        await captureStage02Frame(page, "stage02-boss-damaged");
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
  }, undefined, true); // Observe aircraft hulls as in the full Stage02→03 route.
  await page.keyboard.up("Space");
  await expect
    .poll(async () => (await state(page)).mode, { timeout: 10000 })
    .toBe("won");
  const done = await state(page);
  expect(done.bossDefeated).toBe(true);
  expect(brokenCaptured, "damaged Boss pods were captured during normal combat").toBe(true);
  const presentation = done.renderMetrics.presentationCoverage;
  for (const role of ["straight", "weave", "cross", "brakeRaider", "hookWing", "carrier", "groundBattery", "groundDepot", "gatekeeper", "outrider", "bomber", "missileTruck", "flakBattery"]) expect(presentation[role]?.visible, role + " actually appeared").toBeTruthy();
  await testInfo.attach("stage02-actual-enemy-presentation", {body: JSON.stringify({presentation, roleFrames, note: "Source timing indexes are observations, not a claim every role fired or died. Match the full video and screenshot before accepting visual quality."}, null, 2), contentType: "application/json"});
  console.log("STAGE02_ACTUAL_ENEMY_PRESENTATION", JSON.stringify(presentation));
  expect(done.background.artReady).toBe(true);
  expect(done.background.basinMix).toBe(1);

  await saveStage02Sampler(page, testInfo);
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
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: testInfo.outputPath("mobile-layout-video"),
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage();
  try {
    await unlockStage02(page);
    await page.locator("#start").click();
    const box = await page.locator("canvas").boundingBox();
    expect(box).not.toBeNull();
    const cdp = await page.context().newCDPSession(page);
    const start = {
      x: box!.x + box!.width * 0.5,
      y: box!.y + box!.height * 0.8,
    };
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
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 320, height: 700 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const bounds = await page.locator("canvas").boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
        viewport.height + 1,
      );
      for (const id of ["touch-bomb", "touch-weapon", "touch-pause"]) {
        const b = await page.locator("#" + id).boundingBox();
        expect(b!.width).toBeGreaterThanOrEqual(44);
        expect(b!.height).toBeGreaterThanOrEqual(44);
        expect(b!.x + b!.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      await page.screenshot({
        path: `docs/stage02-layout-${viewport.width}.png`,
      });
    }
    await page.locator("#touch-pause").click();
    expect((await state(page)).mode).toBe("playing");
    const restored = (await page.locator("canvas").boundingBox())!;
    const before = await state(page);
    const renewed = {
      x: restored.x + restored.width * 0.5,
      y: restored.y + restored.height * 0.8,
      id: 3,
    };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [renewed],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...renewed, x: renewed.x + 35 }],
    });
    await expect
      .poll(async () => (await state(page)).player.x)
      .toBeGreaterThan(before.player.x + 10);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    // Touch mode deliberately hides the desktop in-flight menu. Pause exposes the
    // ordinary menu; do not force-click a hidden control.
    await page.locator("#touch-pause").click();
    expect((await state(page)).mode).toBe("paused");
    await page.locator("#menu").click();
    await page.getByText("設定與本機紀錄", { exact: true }).click();
    await expect(page.locator("#reset")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#reset").click();
    await expect(
      page.locator('#stage-select option[value="stage-02"]'),
    ).toBeDisabled();
    expect((await state(page)).stageId).toBe("stage-01");
  } finally {
    await context.close();
  }
});

test("Stage02 full CDP touch sortie clears and preserves its result", async ({}, testInfo) => {
  test.setTimeout(660000);
  const { chromium } = await import("@playwright/test");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const profile = await mkdtemp(tmpdir() + "/p01-stage02-profile-");
  let context = await chromium.launchPersistentContext(profile, {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: testInfo.outputPath("stage02-touch-video"),
      size: { width: 390, height: 844 },
    },
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
    const { VisibleHullTracker } = await import("../visible-hull-policy");
    const visibleHulls = new VisibleHullTracker();
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
      const hullHazards = visibleHulls.observe(s.time, s.activeEnemies);
      const next = chooseTouchTarget({...s, hostileProjectiles: [...s.hostileProjectiles, ...hullHazards]}, target, budget);
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
    const stored = structuredClone((await state(page)).save);
    await context.close();
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      executablePath: process.env.CHROMIUM_PATH,
    });
    const reopened = await context.newPage();
    await reopened.goto("http://127.0.0.1:4173/");
    await reopened.locator("#stage-select").selectOption("stage-02");
    const restored = await state(reopened);
    expect(restored.save.stages["stage-02"]).toEqual(stored.stages["stage-02"]);
    expect(restored.save.stages["stage-01"]).toEqual(stored.stages["stage-01"]);
    expect(restored.save.settings).toEqual(stored.settings);
    await reopened.screenshot({ path: "docs/stage02-browser-reopened.png" });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
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


test("Stage02 real ground battery turns, fires and is destroyed through normal controls", async ({ page }, testInfo) => {
 test.setTimeout(150000);
 await unlockStage02(page);
 await page.locator("#start").click();
 await page.keyboard.down("Space");
 await withKeyboardPilot(page, () => waitGameTime(page, 28));
 await page.keyboard.up("Space");
 let initialAngle = 0;
 await withKeyboardPilot(page, async () => {
   await waitGameTime(page, 30);
   await captureStage02Frame(page, "stage02-ground-aiming");
   await waitGameTime(page, 31.15);
   const firing = await state(page);
   expect(firing.groundShotCount).toBeGreaterThan(0);
   const turret = firing.activeEnemies.find((e: any) => e.behavior === "groundBattery");
   expect(turret).toBeTruthy();
   initialAngle = turret.turretAngle;
   await captureStage02Frame(page, "stage02-ground-fired");
 });
 const turnUntil = (await state(page)).time + 0.85;
 await withKeyboardPilot(page, async () => {
   await waitGameTime(page, turnUntil);
   const turned = (await state(page)).activeEnemies.find((e: any) => e.behavior === "groundBattery");
   expect(turned).toBeTruthy();
   expect(Math.abs(turned.turretAngle - initialAngle)).toBeGreaterThan(0.02);
   await captureStage02Frame(page, "stage02-ground-turned");
   await page.keyboard.down("Space");
   await expect.poll(async () => (await state(page)).renderMetrics.presentationCoverage.groundBattery?.destroyed, {timeout: 45000, intervals: [30]}).toBeTruthy();
   const killed = await state(page);
   const row = killed.renderMetrics.presentationCoverage.groundBattery;
   expect(row.fired).toBeTruthy(); expect(row.hit).toBeTruthy(); expect(row.destroyed).toBeTruthy();
   expect(killed.mode).toBe("playing");
   await captureStage02Frame(page, "stage02-ground-destroyed");
   await testInfo.attach("stage02-real-ground-battery", {body: JSON.stringify({initialAngle, turnedAngle: turned.turretAngle, ...row},null,2), contentType: "application/json"});
   console.log("STAGE02_REAL_GROUND_BATTERY", JSON.stringify(row));
 }, 50);
 await page.keyboard.up("Space");
});
