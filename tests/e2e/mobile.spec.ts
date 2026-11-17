import { test, expect, webkit } from "@playwright/test";
test.setTimeout(30000);
import { state, waitGameTime } from "./gameplay";
import { chooseTouchTarget } from "../touch-policy";
import { TouchTrace } from "../touch-trace";
import { stage01 } from "../../src/data/stage";
const BOSS_AT = stage01.boss!.at;
const point = (x: number, y: number, id = 1) => ({
  x,
  y,
  id,
  radiusX: 4,
  radiusY: 4,
  force: 1,
});
async function tapButton(page: any, label: string) {
  const box = await page.getByRole("button", { name: label }).boundingBox();
  if (!box) throw new Error(`Missing button ${label}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

for (const [width, height] of [
  [320, 568],
  [390, 667],
  [412, 915],
  [844, 390],
]) {
  test(`mobile layout fits ${width}x${height} with usable controls`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/");
    await page
      .getByRole("button", { name: "開始飛行" })
      .scrollIntoViewIfNeeded();
    await tapButton(page, "開始飛行");
    const canvas = await page.locator("canvas").boundingBox();
    expect(canvas).toBeTruthy();
    expect(canvas!.x).toBeGreaterThanOrEqual(0);
    expect(canvas!.y).toBeGreaterThanOrEqual(0);
    expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(width + 1);
    expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(height + 1);
    for (const id of ["touch-bomb", "touch-weapon", "touch-pause"]) {
      const box = await page.locator("#" + id).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    }
    await page.screenshot({ path: `docs/mobile-${width}-${height}.png` });
    await context.close();
  });
}

test("touch drag, two fingers, cancellation, pause and rotation remain controllable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 667 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await tapButton(page, "開始飛行");
  await page.evaluate(() => {
    const log: unknown[] = [];
    (window as any).__touchEventLog = log;
    for (const name of [
      "pointerdown",
      "pointerup",
      "pointercancel",
      "lostpointercapture",
    ])
      document.addEventListener(
        name,
        (event: any) => {
          log.push({
            type: event.type,
            id: event.pointerId,
            target: event.target.id || event.target.tagName,
          });
          if (log.length > 24) log.shift();
        },
        true,
      );
  });
  const cdp = await context.newCDPSession(page);
  const box = (await page.locator("canvas").boundingBox())!;
  const first = point(box.x + box.width / 2, box.y + box.height * 0.78);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [first],
  });
  const before = await state(page);
  expect(before.player.x).toBeCloseTo(180, 0);
  await page.waitForTimeout(200);
  expect((await state(page)).shots).toBeGreaterThan(0);
  const moved = point(first.x + 40, first.y - 30);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [moved],
  });
  await expect
    .poll(async () => (await state(page)).player.x)
    .toBeGreaterThan(210);
  const button = (await page.locator("#touch-bomb").boundingBox())!;
  const second = point(
    button.x + button.width / 2,
    button.y + button.height / 2,
    2,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [moved, second],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [second],
  });
  await expect.poll(async () => (await state(page)).bombs).toBe(1);
  console.log(
    "secondary touch retained",
    JSON.stringify({
      state: await state(page),
      events: await page.evaluate(() => (window as any).__touchEventLog),
    }),
  );
  expect((await state(page)).touchTarget).toBeTruthy();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect.poll(async () => (await state(page)).touchTarget).toBeFalsy();
  const stopped = (await state(page)).shots;
  await page.waitForTimeout(300);
  expect((await state(page)).shots).toBe(stopped);
  await tapButton(page, "切換武器");
  expect((await state(page)).weaponMode).toBe("beam");
  await tapButton(page, "暫停遊戲");
  const paused = (await state(page)).time;
  await page.waitForTimeout(300);
  expect((await state(page)).time).toBe(paused);
  await page.locator("#touch-pause").tap();
  expect((await state(page)).mode).toBe("playing");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [first],
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await state(page)).touchTarget).toBeFalsy();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await page.screenshot({ path: "docs/mobile-rotation.png" });
  await context.close();
});

test("Stage 01 can clear entirely through touch and preserves the record", async ({
  browser,
}, testInfo) => {
  test.setTimeout(600000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 667 },
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: "test-results/mobile-stage-video",
      size: { width: 390, height: 667 },
    },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await tapButton(page, "開始飛行");
  const cdp = await context.newCDPSession(page);
  const box = (await page.locator("canvas").boundingBox())!;
  const first = point(box.x + box.width / 2, box.y + box.height * 0.8);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [first],
  });
  const initialPointerX = first.x;
  let previousTarget = 180;
  const inputTrace = new TouchTrace();
  let deliveryBudget = 0.2;
  const attachInputTrace = async () =>
    testInfo.attach("touch-input-trace", {
      body: inputTrace.json(),
      contentType: "application/json",
    });
  const touchEvadeUntil = async (seconds: number, untilWon = false) => {
    const start = await state(page);
    const deadline =
      Date.now() + Math.max(15000, (seconds - start.time) * 3000 + 20000);
    while (Date.now() < deadline) {
      const readStarted = Date.now();
      const s = await state(page);
      const readMs = Date.now() - readStarted;
      if (untilWon && s.mode === "won") {
        await attachInputTrace();
        return;
      }
      if (!untilWon && s.time >= seconds) return;
      if (s.mode !== "playing") await attachInputTrace();
      expect(s.mode).toBe("playing");
      const target = chooseTouchTarget(s, previousTarget, deliveryBudget);
      previousTarget = target;
      first.x = initialPointerX + ((target - 180) * box.width) / 360;
      const dispatchStarted = Date.now();
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [first],
      });
      const dispatchMs = Date.now() - dispatchStarted;
      const after = await state(page);
      const gameDelay = Math.max(0, after.time - s.time);
      inputTrace.record({
        time: s.time,
        afterTime: after.time,
        hp: after.hp,
        mode: after.mode,
        player: s.player,
        afterPlayer: after.player,
        target,
        actualTarget: after.touchTarget,
        readMs,
        dispatchMs,
        gameDelay,
        deliveryBudget,
        bullets: s.hostileProjectiles.slice(0, 48),
        enemies: s.activeEnemies.slice(0, 24),
      });
      deliveryBudget = Math.min(0.3, Math.max(0.2, gameDelay * 1.25));
      await page.waitForTimeout(30);
    }
    await attachInputTrace();
    throw new Error(`Touch pilot did not reach ${seconds}s`);
  };
  await touchEvadeUntil(70);
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.some(
          (e: any) =>
            e.behavior === "groundBattery" &&
            e.visibleSince >= 70 &&
            e.telegraph > 0,
        ),
      { timeout: 25000, intervals: [30] },
    )
    .toBe(true);
  const shore = (await state(page)).activeEnemies.find(
    (e: any) =>
      e.behavior === "groundBattery" && e.visibleSince >= 70 && e.telegraph > 0,
  );
  const moveTo = async (x: number) => {
    previousTarget = x;
    first.x = initialPointerX + ((x - 180) * box.width) / 360;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [first],
    });
    await expect
      .poll(async () => Math.abs((await state(page)).player.x - x), {
        intervals: [20],
      })
      .toBeLessThan(12);
  };
  await moveTo(shore.x);
  await page.screenshot({ path: "docs/mobile-second-shore.png" });
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.some((e: any) => e.id === shore.id),
      { timeout: 15000 },
    )
    .toBe(false);
  await moveTo(180);
  for (const time of [BOSS_AT + 15, BOSS_AT + 21]) {
    await touchEvadeUntil(time);
    const b = (await page.locator("#touch-bomb").boundingBox())!;
    const second = point(b.x + b.width / 2, b.y + b.height / 2, 2);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [first, second],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [second],
    });
    await expect
      .poll(async () => (await state(page)).bombs)
      .toBe(time === BOSS_AT + 15 ? 1 : 0);
    const afterBomb = await state(page);
    await testInfo.attach(`touch-after-bomb-${time}`, {
      body: JSON.stringify(
        {
          time: afterBomb.time,
          mode: afterBomb.mode,
          hp: afterBomb.hp,
          bombs: afterBomb.bombs,
          touchTarget: afterBomb.touchTarget,
          boss: afterBomb.boss,
          bossDefeated: afterBomb.bossDefeated,
          save: afterBomb.save,
          inputTrace: JSON.parse(inputTrace.json()),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    if (afterBomb.mode === "won") {
      // Bomb damage can synchronously defeat the Boss. The next render update
      // correctly clears input and saves victory; retaining a touch would be a bug.
      expect(afterBomb.bossDefeated).toBe(true);
      await expect
        .poll(async () => (await state(page)).touchTarget)
        .toBeFalsy();
      await expect
        .poll(
          async () => (await state(page)).save.stages["stage-01"]?.clearCount,
        )
        .toBe(1);
      break;
    }
    expect(
      afterBomb.mode,
      JSON.stringify({
        time: afterBomb.time,
        hp: afterBomb.hp,
        reason: afterBomb.lostReason,
      }),
    ).toBe("playing");
    expect(afterBomb.touchTarget).toBeTruthy();
  }
  await touchEvadeUntil(170, true);
  expect((await state(page)).mode).toBe("won");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect((await state(page)).save.stages["stage-01"].clearCount).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Stage 01 通關" }),
  ).toBeVisible();
  const density = await state(page);
  expect(density.spawnedAir).toBeGreaterThanOrEqual(396);
  expect(
    density.enteredAir -
      stage01.waves.filter((w) => w.behavior === "carrier").length,
  ).toBeGreaterThanOrEqual(396);
  expect(density.renderMetrics.peakAirEnemies).toBeGreaterThanOrEqual(8);
  expect(density.renderMetrics.peakEnemies).toBeLessThanOrEqual(64);
  expect(density.renderMetrics.peakEnemyBullets).toBeLessThanOrEqual(80);
  expect(density.renderMetrics.spritePool).toBeLessThanOrEqual(500);
  console.log(
    "TOUCH_SORTIE_DENSITY",
    JSON.stringify({
      spawned: density.spawnedAir,
      entered: density.enteredAir,
      performance: density.renderMetrics,
    }),
  );
  await page.screenshot({ path: "docs/mobile-won.png" });
  await page.reload();
  await expect(page.getByText("已通關 · 通關 1 次")).toBeVisible();
  await tapButton(page, "開始飛行");
  expect((await state(page)).touchTarget).toBeFalsy();
  expect((await state(page)).bombs).toBe(2);
  await context.close();
});

test("WebKit mobile viewport boots and touch controls unlock audio", async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 667 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await tapButton(page, "開始飛行");
  await expect.poll(async () => (await state(page)).mode).toBe("playing");
  await expect
    .poll(async () => (await state(page)).audio.state)
    .toBe("running");
  await tapButton(page, "切換武器");
  expect((await state(page)).weaponMode).toBe("beam");
  await page.locator("#touch-pause").tap();
  expect((await state(page)).mode).toBe("paused");
  await page.screenshot({ path: "docs/mobile-webkit.png" });
  await browser.close();
});
