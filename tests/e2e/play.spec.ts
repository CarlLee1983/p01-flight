import { writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import {
  state,
  waitGameTime,
  keyboardShoreCounterattack,
  keyboardMoveTo,
  evadeUntil,
  withKeyboardPilot,
} from "./gameplay";
import { stage01 } from "../../src/data/stage";
const BOSS_AT = stage01.boss!.at;
test.use({ video: { mode: "on", size: { width: 500, height: 450 } } });
test("full Stage 01 boss clear, score, retry and reload", async ({ page }) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "開始飛行" })).toBeVisible();
  // Verify the actual loader resources, not only successful canvas creation.
  for (const name of [
    "playerShip1_blue",
    "enemyRed1",
    "laserBlue01",
    "fire03",
  ]) {
    const response = await page.request.get(`/assets/kenney/${name}.png`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  for (const name of [
    "player",
    "scout",
    "heavy",
    "boss",
    "coast",
    "interceptor",
    "carrier",
    "harbor-battlefield",
    "harbor-exit",
    "harbor-refinery",
    "ground-battery",
    "ground-base",
    "ground-turret",
    "ground-depot",
  ]) {
    const response = await page.request.get(`/assets/original/${name}.png`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  await page.screenshot({ path: "docs/menu.png" });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.screenshot({ path: "docs/pickup-guide-320.png" });
  await page
    .locator("canvas")
    .evaluate((canvas) => (canvas.style.filter = "grayscale(1)"));
  await page.screenshot({ path: "docs/pickup-guide-monochrome.png" });
  await page.locator("canvas").evaluate((canvas) => (canvas.style.filter = ""));
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.down("Space");
  // Normal keyboard input only. Center route naturally collects stage pickups.
  await waitGameTime(page, 7.5);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.screenshot({ path: "docs/falling-module-320.png" });
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect
    .poll(async () => (await state(page)).weaponLevel, { timeout: 25000 })
    .toBeGreaterThan(1);
  await expect
    .poll(async () => (await state(page)).pickupNoticeText)
    .toMatch(/火力 LV[23]\/3/);
  await page.screenshot({ path: "docs/playing.png" });
  await waitGameTime(page, 14);
  expect(
    (await state(page)).activeEnemies.some((e: any) => e.behavior === "escort"),
  ).toBe(true);
  await page.screenshot({ path: "docs/escort-formation.png" });
  await waitGameTime(page, 21.5);
  await page.screenshot({ path: "docs/cross-formation.png" });
  // Measure newly spawned ground travel before normal player fire can destroy it.
  await waitGameTime(page, 32.2);
  const groundSnapshot = await state(page);
  const groundBefore = groundSnapshot.activeEnemies.find(
    (e: any) => e.behavior === "groundBattery",
  );
  expect(groundBefore).toBeTruthy();
  await waitGameTime(page, 32.8);
  const groundNext = await state(page);
  const groundAfter = groundNext.activeEnemies.find(
    (e: any) => e.id === groundBefore.id,
  );
  expect(groundAfter).toBeTruthy();
  expect(
    Math.abs(
      (groundAfter.y - groundBefore.y) /
        (groundNext.time - groundSnapshot.time) -
        32,
    ),
  ).toBeLessThan(0.1);
  await waitGameTime(page, 35);
  expect((await state(page)).section.at).toBe(32);
  await page.screenshot({ path: "docs/harbor-ground-targets.png" });
  await waitGameTime(page, 45);
  await expect
    .poll(async () => (await state(page)).supportTime)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await state(page)).supportShots)
    .toBeGreaterThan(0);
  expect((await state(page)).supportDrones).toHaveLength(2);
  await page.screenshot({ path: "docs/wingman-support.png" });
  await waitGameTime(page, 58);
  expect((await state(page)).section.at).toBe(56);
  await page.screenshot({ path: "docs/resupply-approach.png" });
  await keyboardShoreCounterattack(page);
  for (const t of [78, 80.2, 84.2, 100, 105, 112, 123]) {
    await evadeUntil(page, t);
    await withKeyboardPilot(page, () =>
      page.screenshot({ path: `docs/sortie-${t}.png`, timeout: 15000 }),
    );
  }
  await expect
    .poll(async () => (await state(page)).boss?.y ?? -60, { timeout: 80000 })
    .toBeGreaterThanOrEqual(105);
  expect((await state(page)).hudBottom).toBeLessThan(63);
  const layers = await state(page);
  expect(layers.hudLayer).toBeGreaterThan(layers.combatMaxLayer);
  await withKeyboardPilot(page, () =>
    page.screenshot({ path: "docs/boss.png", timeout: 15000 }),
  );
  await page.setViewportSize({ width: 320, height: 700 });
  expect((await state(page)).hudBottom).toBeLessThan(63);
  await withKeyboardPilot(page, () =>
    page.screenshot({ path: "docs/boss-320.png", timeout: 15000 }),
  );
  await page.setViewportSize({ width: 1000, height: 900 });
  // Capture warning and angles from one frame. A second page.evaluate can run
  // after the volley fired and legitimately cleared its charge state.
  let warning: any;
  await expect
    .poll(
      async () => {
        const snapshot = (await state(page)).boss;
        if (snapshot?.attackWarning > 0 && snapshot.attackAngles.length >= 2) {
          warning = snapshot;
          return true;
        }
        return false;
      },
      { timeout: 7000, intervals: [20] },
    )
    .toBe(true);
  expect(warning.attackWarning).toBeGreaterThan(0);
  expect(warning.attackAngles.length).toBeGreaterThanOrEqual(2);
  const sources = (await state(page)).bossChargeSources;
  expect(sources.length).toBeLessThanOrEqual(3);
  expect(new Set(sources.map((p: any) => `${p.x}:${p.y}`)).size).toBe(
    sources.length,
  );
  await withKeyboardPilot(page, () =>
    page.screenshot({ path: "docs/boss-charge-no-guides.png", timeout: 15000 }),
  );
  await expect
    .poll(async () => (await state(page)).audio.recorded?.activeTrack, {
      timeout: 10000,
    })
    .toBe("boss");
  expect((await state(page)).audio.recorded.activeSources).toBeGreaterThan(0);
  expect((await state(page)).audio.recorded.loadedTracks).toContain("boss");
  await evadeUntil(page, BOSS_AT + 7);
  await expect.poll(async () => (await state(page)).partsDestroyed).toBe(2);
  await withKeyboardPilot(page, () =>
    page.screenshot({
      path: "docs/boss-cannons-destroyed.png",
      timeout: 15000,
    }),
  );
  await evadeUntil(page, BOSS_AT + 15);
  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).bombs).toBe(1);
  await withKeyboardPilot(page, () =>
    page.screenshot({ path: "docs/bomb.png", timeout: 15000 }),
  );
  await evadeUntil(page, BOSS_AT + 21);
  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).bombs).toBe(0);
  await expect
    .poll(async () => (await state(page)).boss?.phase, {
      timeout: 20000,
      intervals: [50],
    })
    .toBe(3);
  await expect
    .poll(async () => (await state(page)).partsDestroyed, { timeout: 10000 })
    .toBe(2);
  await withKeyboardPilot(page, () =>
    page.screenshot({ path: "docs/boss-phase3.png", timeout: 15000 }),
  );
  // Independent post-render snapshots diagnose compositor rectangles. Keep the
  // original screenshot/video as evidence; never replace a failed image silently.
  const renderer = (await state(page)).renderer;
  console.log("FRAME_RENDERER", JSON.stringify(renderer));
  expect(renderer.batchSize).toBe(4096);
  expect(renderer.hudBatchRole).toBe("BatchHandlerQuadSingle");
  await withKeyboardPilot(page, async () => {
    for (let i = 0; i < 8; i++) {
      const png = await page.evaluate(() => (window as any).__P01_CAPTURE__());
      expect(png).toMatch(/^data:image\/png;base64,/);
      await writeFile(
        `docs/boss-phase3-framebuffer-${i}.png`,
        Buffer.from(png.split(",")[1], "base64"),
      );
      const source = await page.evaluate(() =>
        (window as any).__P01_HUD_SOURCE__(),
      );
      await writeFile(
        `docs/boss-phase3-hud-source-${i}.png`,
        Buffer.from(source.split(",")[1], "base64"),
      );
    }
    await expect
      .poll(async () => (await state(page)).mode, { timeout: 90000 })
      .toBe("won");
  });
  await page.keyboard.up("Space");
  const won = await state(page);
  expect(won.time).toBeGreaterThanOrEqual(BOSS_AT);
  expect(won.time).toBeLessThanOrEqual(stage01.duration);
  expect(won.bossDefeated).toBe(true);
  expect(won.spawnedAir).toBeGreaterThanOrEqual(396);
  expect(
    won.enteredAir -
      stage01.waves.filter((w) => w.behavior === "carrier").length,
  ).toBeGreaterThanOrEqual(396);
  expect(won.renderMetrics.peakAirEnemies).toBeGreaterThanOrEqual(8);
  expect(won.renderMetrics.peakEnemies).toBeLessThanOrEqual(64);
  expect(won.renderMetrics.peakEnemyBullets).toBeLessThanOrEqual(80);
  expect(won.renderMetrics.spritePool).toBeLessThanOrEqual(500);
  console.log(
    "FULL_SORTIE_DENSITY",
    JSON.stringify({
      spawned: won.spawnedAir,
      entered: won.enteredAir,
      performance: won.renderMetrics,
      measuredFps: won.measuredFps,
      renderer: won.renderer,
    }),
  );
  expect(won.score).toBeGreaterThan(0);
  expect(won.save.stages["stage-01"].clearCount).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Stage 01 通關" }),
  ).toBeVisible();
  await expect(page.locator("#next-stage")).toBeVisible();
  await page.screenshot({ path: "docs/won.png" });
  await page.waitForTimeout(1000);
  expect((await state(page)).save.stages["stage-01"].clearCount).toBe(1);
  await page.reload();
  await expect(page.getByText("已通關 · 通關 1 次")).toBeVisible();
  await expect(
    page.locator('#stage-select option[value="stage-02"]'),
  ).toBeEnabled();
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: "開始飛行" }).click();
    await page.waitForTimeout(100);
    const reset = await state(page);
    expect(reset.weaponLevel).toBe(1);
    expect(reset.weaponMode).toBe("spread");
    expect(reset.bombs).toBe(2);
    expect(reset.supportTime).toBe(0);
    expect(reset.supportDrones).toHaveLength(0);
    expect(reset.focus).toBe(false);
    expect(reset.boss).toBeNull();
    expect(reset.partsDestroyed).toBe(0);
    expect(reset.section.at).toBe(0);
    await page.getByRole("button", { name: "返回標題" }).click();
  }
  expect((await state(page)).bulletPool).toBe(0);
  expect(errors).toEqual([]);
});
test("natural collision defeat, pause and retry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.press("p");
  const before = (await state(page)).time;
  await page.waitForTimeout(500);
  expect((await state(page)).time).toBe(before);
  await page.getByRole("button", { name: "繼續" }).click();
  await expect
    .poll(async () => (await state(page)).mode, { timeout: 60000 })
    .toBe("lost");
  await page.screenshot({ path: "docs/lost.png" });
  await page.getByRole("button", { name: "再飛一次" }).click();
  expect((await state(page)).hp).toBe(3);
});
test("corrupt save and blocked storage are safe", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("p01-flight:save:v1", "bad"),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("無法讀取");
  await page.getByRole("button", { name: "開始飛行" }).click();
  expect((await state(page)).mode).toBe("playing");
});
test("browser closes and reopens with persisted settings and record", async () => {
  test.setTimeout(600000);
  const { chromium } = await import("@playwright/test");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(tmpdir() + "/p01-profile-");
  let context = await chromium.launchPersistentContext(dir, {
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
  });
  try {
    let page = await context.newPage();
    await page.goto("http://127.0.0.1:4173");
    await page.getByRole("button", { name: "開始飛行" }).click();
    await page.keyboard.down("Space");
    await keyboardShoreCounterattack(page);
    await evadeUntil(page, BOSS_AT);
    await page.keyboard.press("c");
    await expect.poll(async () => (await state(page)).weaponMode).toBe("beam");
    expect((await state(page)).weaponLevel).toBe(3);
    await page.screenshot({ path: "docs/beam-boss.png" });
    await evadeUntil(page, BOSS_AT + 15);
    await page.keyboard.press("x");
    await expect.poll(async () => (await state(page)).bombs).toBe(1);
    await evadeUntil(page, BOSS_AT + 21);
    await page.keyboard.press("x");
    await expect.poll(async () => (await state(page)).bombs).toBe(0);
    await expect
      .poll(async () => (await state(page)).mode, { timeout: 45000 })
      .toBe("won");
    const score = (await state(page)).score;
    await context.close();
    context = await chromium.launchPersistentContext(dir, {
      headless: true,
      executablePath: process.env.CHROMIUM_PATH,
    });
    page = await context.newPage();
    await page.goto("http://127.0.0.1:4173");
    await expect(page.getByText("已通關 · 通關 1 次")).toBeVisible();
    await expect(
      page.locator('#stage-select option[value="stage-02"]'),
    ).toBeEnabled();
    expect((await state(page)).save.stages["stage-01"].bestScore).toBe(score);
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("Firefox boot and input smoke", async () => {
  const { firefox } = await import("@playwright/test");
  const browser = await firefox.launch();
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4173");
    await page.getByRole("button", { name: "開始飛行" }).click();
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(400);
    await page.keyboard.up("ArrowRight");
    expect((await state(page)).player.x).toBeGreaterThan(200);
    await page.screenshot({ path: "docs/firefox.png" });
  } finally {
    await browser.close();
  }
});
test("storage write denial shows result warning without breaking game", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await expect
    .poll(async () => (await state(page)).mode, { timeout: 60000 })
    .toBe("lost");
  await expect(page.getByRole("status")).toContainText("未能保存");
  await page.getByRole("button", { name: "再飛一次" }).click();
  expect((await state(page)).hp).toBe(3);
});

test("G1/G2 v1 saved records remain compatible", async ({ page }) => {
  const legacy = {
    saveVersion: 1,
    stages: { "stage-01": { cleared: true, bestScore: 12300, clearCount: 4 } },
    settings: { musicVolume: 0.2, sfxVolume: 0.3 },
  };
  await page.addInitScript((save) => {
    if (!localStorage.getItem("p01-flight:save:v1"))
      localStorage.setItem("p01-flight:save:v1", JSON.stringify(save));
  }, legacy);
  await page.goto("/");
  await expect(page.getByText("已通關 · 通關 4 次")).toBeVisible();
  expect((await state(page)).save).toEqual(legacy);
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.getByRole("button", { name: "返回標題" }).click();
  await page.reload();
  expect((await state(page)).save).toEqual(legacy);
});

test("audio unlock, mute persistence and bomb edge trigger", async ({
  page,
}) => {
  await page.goto("/");
  expect((await state(page)).audio.state).not.toBe("running");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await expect
    .poll(async () => (await state(page)).audio.state)
    .toBe("running");
  await expect
    .poll(async () => (await state(page)).audio.recorded?.activeSources, {
      timeout: 10000,
    })
    .toBeGreaterThan(0);
  await page.keyboard.press("p");
  const pausedMusic = (await state(page)).audio.recorded.positionSeconds;
  await page.waitForTimeout(400);
  expect((await state(page)).audio.recorded.positionSeconds).toBe(pausedMusic);
  expect((await state(page)).audio.activeVoices).toBe(0);
  expect((await state(page)).audio.recorded?.activeSources ?? 0).toBe(0);
  await page.keyboard.press("p");
  await expect
    .poll(async () => (await state(page)).audio.recorded.positionSeconds)
    .toBeGreaterThan(pausedMusic);
  await page.keyboard.down("x");
  await page.waitForTimeout(1000);
  expect((await state(page)).bombs).toBe(1);
  await page.keyboard.up("x");
  await page.getByRole("button", { name: "全部靜音" }).click();
  expect((await state(page)).audio.musicVolume).toBe(0);
  expect((await state(page)).audio.sfxVolume).toBe(0);
  await page.keyboard.press("p");
  expect((await state(page)).audio.activeVoices).toBe(0);
  expect((await state(page)).audio.recorded?.activeSources ?? 0).toBe(0);
  await page.reload();
  expect((await state(page)).save.settings).toEqual({
    musicVolume: 0,
    sfxVolume: 0,
  });
  await expect(page.getByRole("button", { name: "開啟聲音" })).toBeVisible();
});

test("focus movement, weapon key edge and restart defaults", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.down("Shift");
  await expect.poll(async () => (await state(page)).focus).toBe(true);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(100);
  const slowBefore = await state(page);
  await page.waitForTimeout(300);
  const slowAfter = await state(page);
  await page.keyboard.up("ArrowRight");
  const slowSpeed =
    (slowAfter.player.x - slowBefore.player.x) /
    (slowAfter.time - slowBefore.time);
  expect(slowSpeed).toBeGreaterThan(85);
  expect(slowSpeed).toBeLessThan(115);
  await page.keyboard.up("Shift");
  await expect.poll(async () => (await state(page)).focus).toBe(false);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(100);
  const normalBefore = await state(page);
  await page.waitForTimeout(300);
  const normalAfter = await state(page);
  await page.keyboard.up("ArrowLeft");
  const normalSpeed =
    (normalBefore.player.x - normalAfter.player.x) /
    (normalAfter.time - normalBefore.time);
  expect(normalSpeed).toBeGreaterThan(215);
  expect(normalSpeed).toBeLessThan(265);
  await page.keyboard.down("c");
  await page.waitForTimeout(500);
  expect((await state(page)).weaponMode).toBe("beam");
  await page.keyboard.up("c");
  await page.keyboard.press("c");
  await expect.poll(async () => (await state(page)).weaponMode).toBe("missile");
  await page.keyboard.press("c");
  await expect.poll(async () => (await state(page)).weaponMode).toBe("spread");
  await page.keyboard.press("x");
  await page.getByRole("button", { name: "返回標題" }).click();
  await page.getByRole("button", { name: "開始飛行" }).click();
  const reset = await state(page);
  expect(reset.weaponMode).toBe("spread");
  expect(reset.weaponLevel).toBe(1);
  expect(reset.focus).toBe(false);
  expect(reset.bombs).toBe(2);
});

test("continuous coastal travel and parallax are visible, pause freezes them", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({
    viewport: { width: 1000, height: 900 },
    recordVideo: {
      dir: "test-results/scroll-video",
      size: { width: 1000, height: 900 },
    },
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/");
    await page.getByRole("button", { name: "開始飛行" }).click();
    await page.keyboard.down("Space");
    const start = await state(page);
    const before = await page
      .locator("canvas")
      .screenshot({ path: "docs/scroll-00.png" });
    for (let i = 1; i <= 4; i++) {
      await page.waitForTimeout(2000);
      if (i === 2) {
        await page.keyboard.press("c");
        await page.keyboard.press("c");
        await expect
          .poll(async () => (await state(page)).weaponMode)
          .toBe("missile");
        await expect
          .poll(async () =>
            (await state(page)).projectiles.some(
              (b: any) => b.kind === "missile",
            ),
          )
          .toBe(true);
      }
      await page
        .locator("canvas")
        .screenshot({ path: `docs/scroll-0${i}.png` });
    }
    const end = await state(page);
    const after = await page.locator("canvas").screenshot();
    expect(before.equals(after)).toBe(false);
    expect(end.background.distance - start.background.distance).toBeGreaterThan(
      200,
    );
    expect(end.background.speed).toBe(32);
    expect(end.background.cloudSpeed).toBeGreaterThan(end.background.speed);
    expect(end.measuredFps).toBeGreaterThan(20);
    await page.keyboard.press("p");
    const paused = await state(page);
    await page.waitForTimeout(500);
    expect((await state(page)).background.distance).toBe(
      paused.background.distance,
    );
    console.log(
      "scroll proof",
      JSON.stringify({
        start: start.background,
        end: end.background,
        measuredFps: end.measuredFps,
      }),
    );
  } finally {
    await context.close();
  }
});

test("intercepting a supply craft yields a visible weapon choice capsule", async ({
  page,
}) => {
  test.setTimeout(40000);
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.press("c");
  await expect.poll(async () => (await state(page)).weaponMode).toBe("beam");
  await page.keyboard.down("ArrowLeft");
  await expect
    .poll(async () => (await state(page)).player.x, { intervals: [20] })
    .toBeLessThan(105);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.down("Space");
  await expect
    .poll(
      async () =>
        (await state(page)).activePickups.some((p: any) => p.kind === "spread"),
      { timeout: 24000, intervals: [50] },
    )
    .toBe(true);
  await page.screenshot({ path: "docs/weapon-capsule.png" });
  for (let i = 0; i < 30; i++) {
    const s = await state(page),
      pickup = s.activePickups.find((p: any) => p.kind === "spread");
    if (!pickup || Math.abs(pickup.x - s.player.x) < 7) break;
    const key = pickup.x > s.player.x ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(key);
    await page.waitForTimeout(25);
    await page.keyboard.up(key);
  }
  await expect
    .poll(async () => (await state(page)).lastPickup, { timeout: 8000 })
    .toBe("spread");
  expect((await state(page)).weaponMode).toBe("spread");
  expect((await state(page)).weaponLevel).toBeGreaterThan(1);
  await page.screenshot({ path: "docs/weapon-selected.png" });
});

test("mid-stage patrol corvette warns alternating lanes before firing", async ({
  page,
}) => {
  test.setTimeout(100000);
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.down("Space");
  await waitGameTime(page, 39.5);
  await page.keyboard.up("Space");
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.some(
          (e: any) => e.behavior === "gatekeeper",
        ),
      { timeout: 10000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.find(
          (e: any) => e.behavior === "gatekeeper",
        )?.telegraph ?? 0,
      { timeout: 10000, intervals: [40] },
    )
    .toBeGreaterThan(0);
  const first = (await state(page)).activeEnemies.find(
    (e: any) => e.behavior === "gatekeeper",
  );
  expect(first.attackLanes.length).toBeGreaterThan(0);
  await page.screenshot({ path: "docs/patrol-lane-warning.png" });
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.find(
          (e: any) => e.behavior === "gatekeeper",
        )?.attackPattern,
      { timeout: 10000, intervals: [40] },
    )
    .not.toBe(first.attackPattern);
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.find(
          (e: any) => e.behavior === "gatekeeper",
        )?.telegraph ?? 0,
      { timeout: 10000, intervals: [40] },
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: "docs/patrol-opposite-warning.png" });
  expect((await state(page)).mode).toBe("playing");
  // A real weapon choice and movement after reading the opposing lane.
  await page.keyboard.press("KeyC");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.down("Space");
  await page.waitForTimeout(1500);
  expect((await state(page)).weaponMode).toBe("beam");
  await page.screenshot({ path: "docs/patrol-counterattack.png" });
  await page.keyboard.up("Space");
});

test("ground batteries visibly warn and fire during continuous normal shooting", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.down("Space");
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.some(
          (e: any) =>
            e.behavior === "groundBattery" && e.y >= 108 && e.telegraph > 0,
        ),
      { timeout: 75000, intervals: [30] },
    )
    .toBe(true);
  const warning = await state(page);
  expect(warning.mode).toBe("playing");
  expect(warning.background.harborArtReady).toBe(true);
  const target = warning.activeEnemies.find(
    (e: any) => e.behavior === "groundBattery" && e.telegraph > 0,
  );
  await page.screenshot({ path: "docs/ground-continuous-fire-warning.png" });
  // Dodge the fixed aim and turn the main gun onto the visible shore battery.
  await keyboardMoveTo(page, target.x, 18);
  await expect
    .poll(async () => (await state(page)).groundShotCount, { timeout: 5000 })
    .toBeGreaterThan(0);
  await page.screenshot({ path: "docs/ground-counterattack.png" });
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.some((e: any) => e.id === target.id),
      { timeout: 15000 },
    )
    .toBe(false);
  // Return to the supply lane using input, never mutate the game model.
  await keyboardMoveTo(page, 180, 12);
  await evadeUntil(page, 56);
  for (const time of [56, 64, 66, 69]) {
    await evadeUntil(page, time);
    const snapshot = await state(page);
    expect(snapshot.mode).toBe("playing");
    expect(snapshot.background.harborArtAlpha).toBeGreaterThan(0.8);
    expect(snapshot.background.exitReady).toBe(true);
    expect(snapshot.background.exitY).toBeCloseTo(
      (snapshot.time - 108) * 32 - 720,
      0,
    );
    await page.screenshot({ path: `docs/approach-continuous-${time}.png` });
  }
  await page.keyboard.up("Space");
});
