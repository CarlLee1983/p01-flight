import { test, expect, type Page } from "@playwright/test";
import { state } from "./gameplay";
import { SAVE_KEY } from "../../src/storage/save";
import { lateFrontDirection } from "../late-front-policy";
const v34 = {
  saveVersion: 1,
  stages: {
    "stage-01": { cleared: true, bestScore: 12345, clearCount: 1 },
    "stage-02": { cleared: true, bestScore: 23456, clearCount: 2 },
    "stage-03": { cleared: true, bestScore: 34567, clearCount: 3 },
  },
  settings: { musicVolume: 0.1, sfxVolume: 0.2 },
};
async function priorCampaign(page: Page) {
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(save));
    },
    { key: SAVE_KEY, save: v34 },
  );
  await page.goto("/?seed=42");
}
test("normal keyboard clears Stage 04 and Stage 05; reload retains new and old saves", async ({
  page,
}) => {
  test.setTimeout(1320000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await priorCampaign(page);
  await expect(
    page.locator('#stage-select option[value="stage-04"]'),
  ).toBeEnabled();
  await expect(
    page.locator('#stage-select option[value="stage-05"]'),
  ).toBeDisabled();
  await page.locator("#stage-select").selectOption("stage-04");
  await page.locator("#start").click();
  let fourth: unknown;
  for (const route of [
    { id: "stage-04", at: 148, theme: "ascent", skin: "ascentGate" },
    { id: "stage-05", at: 164, theme: "orbital", skin: "orbitalLattice" },
  ]) {
    const seen = new Set<string>(),
      captures: Promise<unknown>[] = [];
    let held = 0,
      firing = false,
      bombs = 0,
      captureError: unknown;
    const deadline = Date.now() + 600000;
    try {
      while (Date.now() < deadline) {
        const s = await state(page);
        if (s.mode !== "playing") {
          expect(
            s.mode,
            JSON.stringify({
              time: s.time,
              hp: s.hp,
              reason: s.lostReason,
              seen: [...seen],
            }),
          ).toBe("won");
          break;
        }
        expect(s.stageId).toBe(route.id);
        const action = s.time < route.at || s.time > route.at + 6;
        if (firing !== action) {
          firing = action;
          if (firing) await page.keyboard.down("Space");
          else await page.keyboard.up("Space");
        }
        if (
          s.time >= route.at + (bombs ? 19 : 12) &&
          bombs < 2 &&
          s.bombs > 0
        ) {
          await page.keyboard.press("x");
          bombs++;
        }
        const dir = lateFrontDirection(s);
        if (dir !== held) {
          if (held)
            await page.keyboard.up(held < 0 ? "ArrowLeft" : "ArrowRight");
          held = dir;
          if (held)
            await page.keyboard.down(held < 0 ? "ArrowLeft" : "ArrowRight");
        }
        if (s.boss?.motion?.entered) seen.add("phase-" + s.boss.phase);
        for (const r of s.sustainedFire) {
          const label = (s.boss?.active ? "boss-" : "mini-") + r.state;
          if (seen.has(label)) continue;
          seen.add(label);
          if (r.state === "live")
            captures.push(
              page
                .screenshot({
                  path: "docs/" + route.id + "-" + label + ".png",
                  timeout: 15000,
                })
                .catch((e) => {
                  captureError = e;
                }),
            );
        }
        await page.waitForTimeout(20);
      }
    } finally {
      if (firing) await page.keyboard.up("Space");
      if (held) await page.keyboard.up(held < 0 ? "ArrowLeft" : "ArrowRight");
      await Promise.all(captures);
    }
    if (captureError) throw captureError;
    const s = await state(page);
    expect(s.mode).toBe("won");
    expect(s.bossDefeated).toBe(true);
    expect(s.boss.skin).toBe(route.skin);
    expect(s.background).toMatchObject({ theme: route.theme, artReady: true });
    expect([...seen]).toEqual(
      expect.arrayContaining([
        "phase-1",
        "phase-2",
        "phase-3",
        "boss-charge",
        "boss-live",
      ]),
    );
    expect(s.save.stages[route.id]).toMatchObject({
      cleared: true,
      bestScore: s.score,
      clearCount: 1,
    });
    await page.screenshot({ path: "docs/" + route.id + "-clear.png" });
    if (route.id === "stage-04") {
      expect([...seen]).toEqual(
        expect.arrayContaining(["mini-charge", "mini-live"]),
      );
      fourth = s.save.stages[route.id];
      await expect(page.locator("#next-stage")).toHaveText("前往 Stage 05");
      await page.locator("#next-stage").click();
    } else {
      await expect(page.locator("#next-stage")).toHaveCount(0);
      await expect(page.getByText("星門已摧毀：全戰役通關")).toBeVisible();
      await page.reload();
      await page.locator("#stage-select").selectOption(route.id);
      const data = (await state(page)).save;
      expect(data.stages).toMatchObject({
        ...v34.stages,
        "stage-04": fourth,
        [route.id]: s.save.stages[route.id],
      });
      expect(data.settings).toEqual(v34.settings);
    }
  }
  expect(errors).toEqual([]);
});
test("320px touch play and failure retry do not unlock the finale", async ({
  browser,
}) => {
  test.setTimeout(280000);
  const page = await browser.newPage({
    viewport: { width: 320, height: 720 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await priorCampaign(page);
    await page.locator("#stage-select").selectOption("stage-04");
    await page.screenshot({ path: "docs/stage-04-320.png" });
    await page.locator("#start").tap();
    const cdp = await page.context().newCDPSession(page);
    const box = (await page.locator("canvas").boundingBox())!;
    const pt = (x: number, y: number) => ({
      x: box.x + box.width * x,
      y: box.y + box.height * y,
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [pt(0.5, 0.87)],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [pt(0.75, 0.87)],
    });
    await expect
      .poll(async () => (await state(page)).player.x)
      .toBeGreaterThan(195);
    await expect.poll(async () => (await state(page)).shots).toBeGreaterThan(0);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () => (await state(page)).mode, { timeout: 230000 })
      .toBe("lost");
    await expect(page.locator("#next-stage")).toHaveCount(0);
    await page.locator("#retry").tap();
    expect((await state(page)).stageId).toBe("stage-04");
    expect((await state(page)).hp).toBe(3);
  } finally {
    await page.close();
  }
});
