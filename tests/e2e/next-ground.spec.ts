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
    if (role === "missileTruck") {
      await withKeyboardPilot(
        page,
        () =>
          expect
            .poll(async () => (await state(page)).hostileMissiles.rendered, {
              timeout: 5000,
            })
            .toBeGreaterThan(0),
        undefined,
        true,
      );
      const observed = await state(page);
      expect(
        observed.nextAssets.find((a: any) => a.key === "hostile-missile-v2"),
      ).toMatchObject({ ready: true, bitmap: true });
      await withKeyboardPilot(
        page,
        () => captureStage02Frame(page, "stage03-missile-sprite-flight"),
        undefined,
        true,
      );
      await info.attach("missile-sprite-resource", {
        body: JSON.stringify({
          time: observed.time,
          missiles: observed.hostileMissiles,
        }),
        contentType: "application/json",
      });
    }
    const id = target.id,
      angle = target.turretAngle;
    await withKeyboardPilot(
      page,
      () => captureStage02Frame(page, `stage03-${role}-fired`),
      undefined,
      true,
    );
    // A fixed goal may already be occupied; a full-width detour can let the
    // truck pass the player's firing line. Move a real 60px, usually toward
    // the observed gun, then counterattack while returning to its lane.
    const playerX = (await state(page)).player.x;
    const direction =
      Math.abs(target.x - playerX) > 60
        ? Math.sign(target.x - playerX)
        : playerX < 180
          ? 1
          : -1;
    const turnGoal = Math.max(40, Math.min(320, playerX + direction * 60));
    await keyboardMoveTo(page, turnGoal, 16);
    await withKeyboardPilot(
      page,
      () =>
        expect
          .poll(
            async () => {
              const current = (await state(page)).activeEnemies.find(
                (e: any) => e.id === id,
              );
              expect(current).toBeTruthy();
              return Math.abs(current.turretAngle - angle);
            },
            { timeout: 5000, intervals: [40] },
          )
          .toBeGreaterThan(0.02),
      turnGoal,
      true,
    );
    snapshot = await state(page);
    const turned = snapshot.activeEnemies.find((e: any) => e.id === id);
    expect(turned).toBeTruthy();
    expect(Math.abs(turned.turretAngle - angle)).toBeGreaterThan(0.02);
    await captureStage02Frame(page, `stage03-${role}-turned`);
    await page.keyboard.down("Space");
    await keyboardMoveTo(page, turned.x, 16);
    const combatTrace: unknown[] = [];
    let lastRecorded = -Infinity;
    await withKeyboardPilot(
      page,
      async () => {
        try {
          await expect
            .poll(
              async () => {
                const observed = await state(page);
                const actor = observed.activeEnemies.find(
                  (e: any) => e.id === id,
                );
                if (observed.time - lastRecorded >= 0.25) {
                  combatTrace.push({
                    time: observed.time,
                    player: observed.player,
                    hp: observed.hp,
                    actor: actor ?? null,
                  });
                  if (combatTrace.length > 160) combatTrace.shift();
                  lastRecorded = observed.time;
                }
                return observed.renderMetrics.presentationCoverage[role]
                  ?.destroyed;
              },
              { timeout: 35000, intervals: [40] },
            )
            .toBeTruthy();
        } finally {
          await info.attach(`${role}-bounded-counterattack-trace`, {
            body: JSON.stringify(
              {
                id,
                playerX,
                turnGoal,
                angle,
                turnedAngle: turned.turretAngle,
                combatTrace,
              },
              null,
              2,
            ),
            contentType: "application/json",
          });
        }
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
