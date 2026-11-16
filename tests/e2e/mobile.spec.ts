import { test, expect, webkit } from "@playwright/test";
test.setTimeout(30000);
const state = (page: any) => page.evaluate(() => (window as any).__P01__());
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
}) => {
  test.setTimeout(180000);
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
  for (const time of [85, 91]) {
    await expect
      .poll(async () => (await state(page)).time, {
        timeout: 125000,
        intervals: [100],
      })
      .toBeGreaterThanOrEqual(time);
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
      .toBe(time === 85 ? 1 : 0);
    expect((await state(page)).touchTarget).toBeTruthy();
  }
  await expect
    .poll(async () => (await state(page)).mode, { timeout: 30000 })
    .toBe("won");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect((await state(page)).save.stages["stage-01"].clearCount).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Stage 01 通關" }),
  ).toBeVisible();
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
