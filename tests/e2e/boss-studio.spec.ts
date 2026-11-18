import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
let dev: ChildProcess;
test.beforeAll(async () => {
  dev = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "4181",
      "--strictPort",
    ],
    { stdio: "ignore" },
  );
  await expect
    .poll(
      async () => {
        try {
          return (
            await fetch("http://127.0.0.1:4181/tests/fixtures/boss-studio.html")
          ).status;
        } catch {
          return 0;
        }
      },
      { timeout: 20000 },
    )
    .toBe(200);
});
test.afterAll(() => dev?.kill());
test.use({ video: "on" });
for (const [skin, count] of [
  ["command", 2],
  ["riverFortress", 3],
  ["polarRadar", 4],
] as const)
  test(`${skin} live shared renderer, three phases and all wreck states`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4181/tests/fixtures/boss-studio.html");
    await page.locator("#rig").selectOption(skin);
    await expect(page.locator("#status")).toContainText(`部件 ${count}`);
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `docs/boss-${skin}-intact.png`,
      fullPage: true,
    });
    for (const phase of ["2", "3"]) {
      await page.locator("#phase").selectOption(phase);
      await page.waitForTimeout(10000);
      await page.screenshot({
        path: `docs/boss-${skin}-phase${phase}.png`,
        fullPage: true,
      });
    }
    await page.locator("#break").click();
    await expect(page.locator("#status")).toContainText(`部件 ${count - 1}`);
    await page.screenshot({
      path: `docs/boss-${skin}-partial.png`,
      fullPage: true,
    });
    for (let i = 1; i < count; i++) await page.locator("#break").click();
    await expect(page.locator("#status")).toContainText("部件 0");
    await page.screenshot({
      path: `docs/boss-${skin}-wreck.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 700 });
    await page.screenshot({
      path: `docs/boss-${skin}-320.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
    await info.attach("scope", {
      body: "Visual rehearsal only. Phase/part fixture controls are excluded from the production build. Full unmodified-stage keyboard/touch tests remain separate.",
      contentType: "text/plain",
    });
  });
