import { chooseAction, type Steering } from "../keyboard-policy";
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
  await evadeUntil(page, 70);
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
  await keyboardMoveTo(page, target.x, 18);
  await page.screenshot({ path: "docs/second-shore-counterattack.png" });
  await expect
    .poll(
      async () =>
        (await state(page)).activeEnemies.some((e: any) => e.id === target.id),
      { timeout: 15000 },
    )
    .toBe(false);
  await keyboardMoveTo(page, 180, 12);
}

/** Closed-loop goal steering. Never leave a key held until a narrow position
 * poll succeeds: a delayed snapshot may already have crossed that position. */
export async function keyboardMoveTo(
  page: Page,
  goalX: number,
  tolerance = 12,
) {
  const start = await state(page);
  const deadline = Date.now() + 30000;
  let held: Steering = 0;
  const trace: unknown[] = [];
  const release = async () => {
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.up("ArrowRight");
    held = 0;
  };
  try {
    while (Date.now() < deadline) {
      const s = await state(page);
      trace.push({
        time: s.time,
        x: s.player.x,
        hp: s.hp,
        mode: s.mode,
        held,
        goalX,
      });
      if (trace.length > 64) trace.shift();
      expect(s.mode, JSON.stringify(trace)).toBe("playing");
      if (Math.abs(s.player.x - goalX) < tolerance) {
        await release();
        // key-up transport can itself move the ship. Verify its settled position.
        const settled = await state(page);
        expect(settled.mode, JSON.stringify(trace)).toBe("playing");
        if (Math.abs(settled.player.x - goalX) < tolerance) return settled;
        continue;
      }
      if (s.time - start.time > 8)
        throw new Error(
          `Keyboard goal did not converge: ${JSON.stringify(trace)}`,
        );
      const next = chooseAction(s, held, goalX);
      if (next !== held) {
        await release();
        if (next)
          await page.keyboard.down(next < 0 ? "ArrowLeft" : "ArrowRight");
        held = next;
      }
      // Re-read position and hazards even while a key is held; reverse after
      // overshoot rather than continuing toward the boundary indefinitely.
      await page.waitForTimeout(20);
    }
    throw new Error(
      `Keyboard goal wall-time bound exceeded: ${JSON.stringify(trace)}`,
    );
  } finally {
    await release();
  }
}

/** Real-key pilot for survival waits. Reads visible projectile positions only;
 * never writes health, clocks, shots or model state. */
export async function evadeUntil(page: Page, seconds: number) {
  let held: Steering = 0;
  const trace: unknown[] = [];
  const start = await state(page);
  const deadline =
    Date.now() + Math.max(15000, (seconds - start.time) * 3000 + 20000);
  try {
    while (Date.now() < deadline) {
      const s = await state(page);
      if (s.time >= seconds) return s;
      expect(
        s.mode,
        JSON.stringify({
          time: s.time,
          hp: s.hp,
          player: s.player,
          fps: s.measuredFps,
          trace,
        }),
      ).toBe("playing");
      const dx = chooseAction(s, held);
      trace.push({ time: s.time, x: s.player.x, hp: s.hp, held, next: dx });
      if (trace.length > 20) trace.shift();
      // Keep one real key state: change it only when the swept-path decision
      // changes, avoiding a down/wait/up RPC chain for every tiny movement.
      if (dx !== held) {
        if (held) await page.keyboard.up(held < 0 ? "ArrowLeft" : "ArrowRight");
        if (dx) await page.keyboard.down(dx < 0 ? "ArrowLeft" : "ArrowRight");
        held = dx;
      }
      await page.waitForTimeout(20);
    }
    throw new Error(`Evading pilot did not reach ${seconds}s`);
  } finally {
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.up("ArrowRight");
  }
}

/** Same visible-projectile policy as model-route tests, no hidden future data. */
export function dodgeInput(s: any, lookahead = 100, clearance = 32): number {
  const incoming = s.hostileProjectiles.filter(
    (b: any) =>
      b.vy > 0 && b.y < s.player.y + 12 && b.y > s.player.y - lookahead,
  );
  const danger = (x: number) =>
    incoming.reduce((sum: number, b: any) => {
      const t = Math.max(0, (s.player.y - b.y) / b.vy);
      return (
        sum + Math.max(0, clearance - Math.abs(b.x + b.vx * t - x)) / (0.3 + t)
      );
    }, 0);
  const stay = danger(s.player.x);
  let dx = 0;
  if (stay > 0) {
    const left = s.player.x > 55 ? danger(s.player.x - 36) : Infinity;
    const right = s.player.x < 305 ? danger(s.player.x + 36) : Infinity;
    if (Math.min(left, right) < stay) dx = left < right ? -1 : 1;
  } else if (Math.abs(s.player.x - 180) > 10) dx = Math.sign(180 - s.player.x);
  return dx;
}
