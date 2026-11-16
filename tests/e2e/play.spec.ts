import { test, expect } from "@playwright/test";
const state = (page: any) => page.evaluate(() => (window as any).__P01__());
test("real 75-second stage, score, result, retry and reload", async ({
  page,
}) => {
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
  // Shoot from the center then move into a safe corridor; no debug mutation.
  await page.waitForTimeout(12000);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(800);
  await page.keyboard.up("ArrowLeft");
  expect((await state(page)).player.x).toBeLessThan(70);
  await page.screenshot({ path: "docs/playing.png" });
  await expect
    .poll(async () => (await state(page)).mode, { timeout: 90000 })
    .toBe("won");
  await page.keyboard.up("Space");
  const won = await state(page);
  expect(won.time).toBe(75);
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
    await page.waitForTimeout(12000);
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(800);
    await page.keyboard.up("ArrowLeft");
    await expect
      .poll(async () => (await state(page)).mode, { timeout: 90000 })
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
