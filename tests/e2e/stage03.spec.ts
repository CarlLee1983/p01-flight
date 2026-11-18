import { test, expect, type Page } from "@playwright/test";
import { state, withKeyboardPilot, waitGameTime } from "./gameplay";
import {
  installStage02Sampler,
  saveStage02Sampler,
  captureStage02Frame,
} from "./stage02-render-evidence";
import { chooseThirdFront } from "./next-fronts-helpers";
test.use({ video: { mode: "on", size: { width: 500, height: 700 } } });
test("third front remains locked with only the first front cleared", async ({
  page,
}) => {
  await chooseThirdFront(page, false);
  await expect(
    page.locator('#stage-select option[value="stage-03"]'),
  ).toBeDisabled();
  await expect(
    page.locator('#stage-select option[value="stage-02"]'),
  ).toBeEnabled();
});
test("normal Stage02 clear connects to polar Stage03, clears, retries and preserves both records", async ({
  page,
}, info) => {
  test.setTimeout(1000000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installStage02Sampler(page, "stage-03", [
    [30, 35],
    [90, 95],
    [157, 161],
  ]);
  await chooseThirdFront(page, false);
  await page.locator("#start").click();
  await page.keyboard.down("Space");
  async function fly(stage: string, bossAt: number, bombTimes: number[]) {
    const roles = new Set<string>(),
      landmarks = new Set<string>();
    let intact = false,
      damaged = false,
      bombs = 0,
      holding = false,
      bomberObserved = false;
    const deadline = Date.now() + 430000;
    await withKeyboardPilot(
      page,
      async () => {
        while (Date.now() < deadline) {
          const s = await state(page);
          if (s.mode !== "playing") {
            expect(s.mode).toBe("won");
            break;
          }
          const actor = s.activeEnemies.find(
            (e: any) =>
              !roles.has(e.behavior) &&
              e.y >= 120 &&
              e.y <= 390 &&
              e.x >= 24 &&
              e.x <= 336,
          );
          if (actor) {
            roles.add(actor.behavior);
            await captureStage02Frame(page, `${stage}-role-${actor.behavior}`);
          }
          if (stage === "stage03" && s.time >= 84 && !bomberObserved) {
            const bomber = s.activeEnemies.find(
              (e: any) => e.behavior === "bomber",
            );
            if (bomber) {
              await page.keyboard.up("Space");
              if (bomber.shotsFired > 0) {
                bomberObserved = true;
                await captureStage02Frame(page, "stage03-bomber-first-volley");
                await page.keyboard.down("Space");
              }
            }
          }
          if (s.time >= bossAt - 1 && !holding) {
            await page.keyboard.up("Space");
            holding = true;
          }
          if (s.time >= bossAt + 1.8 && s.boss?.active && !intact) {
            intact = true;
            expect(s.boss.cannons.filter((c: any) => c.active)).toHaveLength(2);
            expect(s.bossPresentation.key).toBe(
              stage === "stage03" ? "boss-polar" : "boss-canyon",
            );
            await captureStage02Frame(page, `${stage}-boss-intact`);
            await page.setViewportSize({ width: 320, height: 700 });
            await captureStage02Frame(page, `${stage}-boss-320`);
            await page.setViewportSize({ width: 1000, height: 900 });
            await page.keyboard.down("Space");
          }
          if (
            s.boss?.active &&
            s.boss.cannons.some((c: any) => !c.active) &&
            !damaged
          ) {
            damaged = true;
            await captureStage02Frame(page, `${stage}-boss-damaged`);
          }
          if (bombs < bombTimes.length && s.time >= bombTimes[bombs]) {
            await page.keyboard.press("x");
            bombs++;
          }
          if (
            stage === "stage03" &&
            s.time >= 32 &&
            !landmarks.has("railway")
          ) {
            landmarks.add("railway");
            await captureStage02Frame(page, "stage03-railway");
          }
          if (
            stage === "stage03" &&
            s.time >= 64 &&
            !landmarks.has("airfield")
          ) {
            landmarks.add("airfield");
            await captureStage02Frame(page, "stage03-airfield");
          }
          if (stage === "stage03" && s.time >= 126 && !landmarks.has("radar")) {
            landmarks.add("radar");
            await captureStage02Frame(page, "stage03-radar");
          }
          await page.waitForTimeout(120);
        }
      },
      undefined,
      true,
    );
    const done = await state(page);
    expect(done.mode).toBe("won");
    expect(intact).toBe(true);
    expect(damaged).toBe(true);
    expect(done.bossDefeated).toBe(true);
    await info.attach(`${stage}-actual-presentation`, {
      body: JSON.stringify(
        {
          stage,
          roles: [...roles],
          coverage: done.renderMetrics.presentationCoverage,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await captureStage02Frame(page, `${stage}-clear`);
    return done;
  }
  const second = await fly("stage02-new", 145, [151, 158]);
  await page.keyboard.up("Space");
  const secondRecord = structuredClone(second.save.stages["stage-02"]);
  await expect(page.locator("#next-stage")).toBeVisible();
  await page.locator("#next-stage").click();
  let s = await state(page);
  expect(s.stageId).toBe("stage-03");
  expect(s.time).toBeLessThan(2);
  expect(s.seed).toBe(42);
  expect(s.save.stages["stage-02"]).toEqual(secondRecord);
  expect(s.background.theme).toBe("polar");
  expect(s.nextAssets.every((a: any) => a.ready && a.bitmap)).toBe(true);
  await page.keyboard.down("Space");
  const third = await fly("stage03", 155, [161, 168]);
  await page.keyboard.up("Space");
  expect(third.background.artReady).toBe(true);
  expect(third.background.basinMix).toBe(1);
  expect(third.save.stages["stage-02"]).toEqual(secondRecord);
  expect(third.save.stages["stage-03"].clearCount).toBe(1);
  for (const role of ["outrider", "bomber", "missileTruck", "flakBattery"]) {
    expect(
      third.renderMetrics.presentationCoverage[role]?.visible,
      role + " visible",
    ).toBeTruthy();
    expect(
      third.renderMetrics.presentationCoverage[role]?.fired,
      role + " fired",
    ).toBeTruthy();
  }
  await saveStage02Sampler(page, info, "stage03");
  await expect(page.locator("#next-stage")).toHaveCount(0);
  await page.locator("#retry").click();
  s = await state(page);
  expect(s.stageId).toBe("stage-03");
  expect(s.time).toBeLessThan(2);
  expect(s.seed).toBe(42);
  await page.locator("#menu").click();
  await page.reload();
  await page.locator("#stage-select").selectOption("stage-03");
  expect((await state(page)).save.stages["stage-03"]).toEqual(
    third.save.stages["stage-03"],
  );
  expect(errors).toEqual([]);
});

test("polar front natural failure restarts cleanly without unlocking a phantom next stage", async ({
  page,
}) => {
  test.setTimeout(140000);
  await chooseThirdFront(page);
  await page.locator("#start").click();
  await expect
    .poll(async () => (await state(page)).mode, {
      timeout: 100000,
      intervals: [200],
    })
    .toBe("lost");
  await page.screenshot({ path: "docs/stage03-failed.png" });
  await expect(page.locator("#next-stage")).toHaveCount(0);
  await expect
    .poll(async () => (await state(page)).save.stages["stage-03"]?.clearCount)
    .toBe(0);
  expect((await state(page)).save.stages["stage-02"].bestScore).toBe(5000);
  await page.locator("#retry").click();
  const s = await state(page);
  expect(s.mode).toBe("playing");
  expect(s.stageId).toBe("stage-03");
  expect(s.time).toBeLessThan(2);
  expect(s.hp).toBe(3);
  expect(s.seed).toBe(42);
});
