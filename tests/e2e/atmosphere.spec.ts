import { test, expect } from "@playwright/test";
import { state, waitGameTime } from "./gameplay";
test.use({ video: { mode: "on", size: { width: 320, height: 700 } } });
test("cloud parallax and real combat impact sequence remain readable at 320px", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await page.keyboard.down("Space");
  try {
    const initial = await state(page);
    expect(initial.background.cloudImages).toBe(6);
    await waitGameTime(page, 5);
    const later = await state(page);
    expect(later.background.cloudPositions[0].y).not.toBe(
      initial.background.cloudPositions[0].y,
    );
    expect(later.impactLayer).toBeLessThan(3);
    await expect
      .poll(
        async () =>
          (await state(page)).impactEffects.some((e: any) => e.kind === "hit"),
        { intervals: [16], timeout: 20000 },
      )
      .toBe(true);
    for (let i = 0; i < 5; i++) {
      await page.screenshot({ path: `docs/impact-320-${i}.png` });
      await page.waitForTimeout(45);
    }
    console.log("IMPACT_EVIDENCE", JSON.stringify(await state(page)));
  } finally {
    await page.keyboard.up("Space");
  }
});
