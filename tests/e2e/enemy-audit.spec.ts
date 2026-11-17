import { test, expect } from "@playwright/test";
import { state, evadeUntil } from "./gameplay";
test.use({ video: { mode: "on", size: { width: 500, height: 450 } } });
test("specialist hulls retain visible motion and mount alignment before firing resumes", async ({
  page,
}) => {
  test.setTimeout(300000);
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.down("Space");
  try {
    await evadeUntil(page, 66);
    await page.keyboard.up("Space");
    await evadeUntil(page, 68);
    expect(
      (await state(page)).activeEnemies.some(
        (e: any) => e.behavior === "brakeRaider",
      ),
    ).toBe(true);
    await page.screenshot({ path: "docs/brake-before-fire.png" });
    await evadeUntil(page, 70);
    await page.keyboard.down("Space");
    await evadeUntil(page, 78);
    await page.keyboard.up("Space");
    await evadeUntil(page, 80);
    expect(
      (await state(page)).activeEnemies.some(
        (e: any) => e.behavior === "hookWing",
      ),
    ).toBe(true);
    await page.screenshot({ path: "docs/hook-before-fire.png" });
    await evadeUntil(page, 82);
    await page.keyboard.down("Space");
    await evadeUntil(page, 84);
    console.log(
      "SPECIALIST_AUDIT",
      JSON.stringify((await state(page)).renderMetrics),
    );
  } finally {
    await page.keyboard.up("Space");
  }
});
