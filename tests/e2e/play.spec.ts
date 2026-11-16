import { test, expect } from "@playwright/test";
const state = (page: any) => page.evaluate(() => (window as any).__P01__());
// Read-only diagnostics; every gameplay action is a real keyboard event.
const waitGameTime = (page: any, seconds: number) =>
  expect
    .poll(async () => (await state(page)).time, {
      timeout: 135000,
      intervals: [50],
    })
    .toBeGreaterThanOrEqual(seconds);
test("full Stage 01 boss clear, score, retry and reload", async ({ page }) => {
  test.setTimeout(180000);
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
  await page.screenshot({ path: "docs/menu.png" });
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.down("Space");
  // Normal keyboard input only. Center route naturally collects stage pickups.
  await expect
    .poll(async () => (await state(page)).weaponLevel, { timeout: 25000 })
    .toBeGreaterThan(1);
  await page.screenshot({ path: "docs/playing.png" });
  await expect
    .poll(async () => (await state(page)).boss?.y ?? -60, { timeout: 80000 })
    .toBeGreaterThanOrEqual(105);
  await page.screenshot({ path: "docs/boss.png" });
  await waitGameTime(page, 85);
  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).bombs).toBe(1);
  await page.screenshot({ path: "docs/bomb.png" });
  await waitGameTime(page, 91);
  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).bombs).toBe(0);
  await expect
    .poll(async () => (await state(page)).boss?.phase, {
      timeout: 20000,
      intervals: [50],
    })
    .toBe(3);
  await page.screenshot({ path: "docs/boss-phase3.png" });
  await expect
    .poll(async () => (await state(page)).mode, { timeout: 90000 })
    .toBe("won");
  await page.keyboard.up("Space");
  const won = await state(page);
  expect(won.time).toBeGreaterThanOrEqual(70);
  expect(won.time).toBeLessThanOrEqual(115);
  expect(won.bossDefeated).toBe(true);
  expect(won.score).toBeGreaterThan(0);
  expect(won.save.stages["stage-01"].clearCount).toBe(1);
  await page.screenshot({ path: "docs/won.png" });
  await page.waitForTimeout(1000);
  expect((await state(page)).save.stages["stage-01"].clearCount).toBe(1);
  await page.reload();
  await expect(page.getByText("已通關 · 通關 1 次")).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.getByRole("button", { name: "開始飛行" }).click();
    await page.waitForTimeout(100);
    const reset = await state(page);
    expect(reset.weaponLevel).toBe(1);
    expect(reset.weaponMode).toBe("spread");
    expect(reset.bombs).toBe(2);
    expect(reset.focus).toBe(false);
    expect(reset.boss).toBeNull();
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
  test.setTimeout(180000);
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
    await waitGameTime(page, 70);
    await page.keyboard.press("c");
    await expect.poll(async () => (await state(page)).weaponMode).toBe("beam");
    expect((await state(page)).weaponLevel).toBe(3);
    await page.screenshot({ path: "docs/beam-boss.png" });
    await waitGameTime(page, 85);
    await page.keyboard.press("x");
    await expect.poll(async () => (await state(page)).bombs).toBe(1);
    await waitGameTime(page, 91);
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
  await page.keyboard.down("x");
  await page.waitForTimeout(1000);
  expect((await state(page)).bombs).toBe(1);
  await page.keyboard.up("x");
  await page.getByRole("button", { name: "全部靜音" }).click();
  expect((await state(page)).audio.musicVolume).toBe(0);
  expect((await state(page)).audio.sfxVolume).toBe(0);
  await page.keyboard.press("p");
  expect((await state(page)).audio.activeVoices).toBe(0);
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
  await expect.poll(async () => (await state(page)).weaponMode).toBe("spread");
  await page.keyboard.press("c");
  await page.keyboard.press("x");
  await page.getByRole("button", { name: "返回標題" }).click();
  await page.getByRole("button", { name: "開始飛行" }).click();
  const reset = await state(page);
  expect(reset.weaponMode).toBe("spread");
  expect(reset.weaponLevel).toBe(1);
  expect(reset.focus).toBe(false);
  expect(reset.bombs).toBe(2);
});
