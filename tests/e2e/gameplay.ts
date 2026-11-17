import { expect, type Page } from "@playwright/test";
export const state = (page: Page) =>
  page.evaluate(() => (window as any).__P01__());
// The runner records software-rendered video. Budget wall time explicitly, but
// never convert defeat, pause or a stopped game clock into a successful wait.
export async function waitGameTime(page: Page, seconds: number) {
  const start = await state(page);
  const deadline =
    Date.now() + Math.max(15000, (seconds - start.time) * 3000 + 20000);
  let lastTime = start.time,
    progressedAt = Date.now();
  while (Date.now() < deadline) {
    const s = await state(page);
    if (s.time >= seconds) return s;
    if (s.mode !== "playing")
      throw new Error(
        `Game ended/stopped before ${seconds}s: ${JSON.stringify({ time: s.time, mode: s.mode, hp: s.hp, lostReason: s.lostReason })}`,
      );
    if (s.time > lastTime) {
      lastTime = s.time;
      progressedAt = Date.now();
    }
    if (Date.now() - progressedAt > 20000)
      throw new Error(`Game clock stalled at ${s.time}s`);
    await page.waitForTimeout(100);
  }
  throw new Error(
    `Game did not reach ${seconds}s within bounded wall-time budget: ${JSON.stringify(await state(page))}`,
  );
}
export async function keyboardShoreCounterattack(page: Page) {
  await waitGameTime(page, 70);
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
  const s = await state(page);
  const target = s.activeEnemies.find(
    (e: any) =>
      e.behavior === "groundBattery" && e.visibleSince >= 70 && e.telegraph > 0,
  );
  const key = target.x < s.player.x ? "ArrowLeft" : "ArrowRight";
  await page.keyboard.down(key);
  await expect
    .poll(async () => Math.abs((await state(page)).player.x - target.x), {
      intervals: [20],
    })
    .toBeLessThan(18);
  await page.keyboard.up(key);
  await page.screenshot({ path: "docs/second-shore-counterattack.png" });
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.some((e: any) => e.id === target.id),
      { timeout: 15000 },
    )
    .toBe(false);
  const back = (await state(page)).player.x < 180 ? "ArrowRight" : "ArrowLeft";
  await page.keyboard.down(back);
  await expect
    .poll(async () => Math.abs((await state(page)).player.x - 180), {
      intervals: [20],
    })
    .toBeLessThan(12);
  await page.keyboard.up(back);
}

/** Real-key pilot for survival waits. Reads visible projectile positions only;
 * never writes health, clocks, shots or model state. */
export async function evadeUntil(page: Page, seconds: number) {
  const start = await state(page);
  const deadline =
    Date.now() + Math.max(15000, (seconds - start.time) * 3000 + 20000);
  let held = "";
  try {
    while (Date.now() < deadline) {
      const s = await state(page);
      if (s.time >= seconds) return s;
      expect(s.mode).toBe("playing");
      const incoming = s.hostileProjectiles.filter(
        (b: any) => b.vy > 0 && b.y < s.player.y + 12 && b.y > s.player.y - 150,
      );
      const danger = (x: number) =>
        incoming.reduce((sum: number, b: any) => {
          const t = Math.max(0, (s.player.y - b.y) / b.vy);
          return (
            sum + Math.max(0, 36 - Math.abs(b.x + b.vx * t - x)) / (0.3 + t)
          );
        }, 0);
      const stay = danger(s.player.x);
      let dx = 0;
      if (stay > 0) {
        const left = s.player.x > 55 ? danger(s.player.x - 40) : Infinity;
        const right = s.player.x < 305 ? danger(s.player.x + 40) : Infinity;
        if (Math.min(left, right) < stay) dx = left < right ? -1 : 1;
      } else if (Math.abs(s.player.x - 180) > 12)
        dx = Math.sign(180 - s.player.x);
      const key = dx < 0 ? "ArrowLeft" : dx > 0 ? "ArrowRight" : "";
      if (key !== held) {
        if (held) await page.keyboard.up(held);
        if (key) await page.keyboard.down(key);
        held = key;
      }
      await page.waitForTimeout(30);
    }
    throw new Error(`Evading pilot did not reach ${seconds}s`);
  } finally {
    if (held) await page.keyboard.up(held);
  }
}
