import { test, expect } from "@playwright/test";
import {
  state,
  withKeyboardPilot,
  waitGameTime,
  keyboardMoveTo,
} from "./gameplay";
import { captureStage02Frame } from "./stage02-render-evidence";
import { chooseThirdFront } from "./next-fronts-helpers";
test.use({ video: { mode: "on", size: { width: 500, height: 700 } } });
test("mobile missile vehicle and flak emplacement rotate, fire and are destroyed with normal controls", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  await chooseThirdFront(page);
  await page.locator("#start").click();
  await page.keyboard.down("Space");
  await withKeyboardPilot(page, () => waitGameTime(page, 32), undefined, true);
  await page.keyboard.up("Space");
  for (const [role, at] of [
    ["missileTruck", 35.6],
    ["flakBattery", 45.8],
  ] as const) {
    await withKeyboardPilot(
      page,
      () => waitGameTime(page, at),
      undefined,
      true,
    );
    let snapshot = await state(page);
    const target = snapshot.activeEnemies.find((e: any) => e.behavior === role);
    expect(target).toBeTruthy();
    expect(target.shotsFired).toBeGreaterThan(0);
    const id = target.id,
      angle = target.turretAngle;
    await withKeyboardPilot(
      page,
      () => captureStage02Frame(page, `stage03-${role}-fired`),
      undefined,
      true,
    );
    await keyboardMoveTo(page, role === "missileTruck" ? 120 : 180, 16);
    const until = (await state(page)).time + 0.9;
    await withKeyboardPilot(
      page,
      () => waitGameTime(page, until),
      role === "missileTruck" ? 120 : 180,
      true,
    );
    snapshot = await state(page);
    const turned = snapshot.activeEnemies.find((e: any) => e.id === id);
    expect(turned).toBeTruthy();
    expect(Math.abs(turned.turretAngle - angle)).toBeGreaterThan(0.02);
    await captureStage02Frame(page, `stage03-${role}-turned`);
    await keyboardMoveTo(page, turned.x, 16);
    await page.keyboard.down("Space");
    await withKeyboardPilot(
      page,
      async () => {
        await expect
          .poll(
            async () =>
              (await state(page)).renderMetrics.presentationCoverage[role]
                ?.destroyed,
            { timeout: 35000, intervals: [40] },
          )
          .toBeTruthy();
        await captureStage02Frame(page, `stage03-${role}-destroyed`);
      },
      turned.x,
      true,
    );
    const row = (await state(page)).renderMetrics.presentationCoverage[role];
    for (const event of ["visible", "fired", "hit", "destroyed"])
      expect(row[event]?.id).toBe(id);
    await info.attach(`${role}-actual-ground-combat`, {
      body: JSON.stringify(
        { initialAngle: angle, turnedAngle: turned.turretAngle, ...row },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await page.keyboard.up("Space");
    await keyboardMoveTo(page, 180, 16);
  }
  expect((await state(page)).mode).toBe("playing");
});
