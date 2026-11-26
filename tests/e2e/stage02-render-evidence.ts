import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

export const STAGE02_PERF_WINDOWS = [
  [30, 35],
  [100, 105],
  [146, 150],
] as const;
/** Test-only observation. Does not patch bundle, advance time or change gameplay.
 * Calls are actual GL submission counts. RAF intervals are wall-clock intervals,
 * not GPU execution duration. Screenshot/video overhead is explicitly recorded.
 */
export async function installStage02Sampler(
  page: Page,
  stageId = "stage-02",
  windows: readonly (readonly [number, number])[] = STAGE02_PERF_WINDOWS,
) {
  await page.addInitScript(
    ({ windows, stageId }) => {
      const w = window as any;
      let calls = 0,
        last = 0,
        patchedMethods = 0;
      const buckets = windows.map(
        () => [] as { time: number; calls: number; intervalMs: number }[],
      );
      for (const name of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
        const proto = w[name]?.prototype;
        if (!proto) continue;
        for (const method of [
          "drawElements",
          "drawArrays",
          "drawElementsInstanced",
          "drawArraysInstanced",
        ]) {
          const descriptor = Object.getOwnPropertyDescriptor(proto, method);
          if (!descriptor || typeof descriptor.value !== "function") continue;
          const original = descriptor.value;
          Object.defineProperty(proto, method, {
            ...descriptor,
            value: function (...args: unknown[]) {
              calls++;
              return original.apply(this, args);
            },
          });
          patchedMethods++;
        }
      }
      const result = {
        stageId,
        windows,
        buckets,
        bossPhase3: [] as {
          time: number;
          calls: number;
          intervalMs: number;
          missiles: number;
        }[],
        patchedMethods,
        overflow: false,
        renderer: null as unknown,
      };
      w.__STAGE02_RENDER__ = result;
      const sample = (now: number) => {
        const s = w.__P01__?.();
        if (s?.stageId === stageId && s.mode === "playing") {
          result.renderer = s.renderer;
          if (s.boss?.active && s.boss.phase === 3 && last) {
            if (result.bossPhase3.length < 4096)
              result.bossPhase3.push({
                time: s.time,
                calls,
                intervalMs: now - last,
                missiles: s.hostileMissiles?.rendered ?? 0,
              });
            else result.overflow = true;
          }
          for (let i = 0; i < windows.length; i++)
            if (s.time >= windows[i][0] && s.time < windows[i][1] && last) {
              if (buckets[i].length < 4096)
                buckets[i].push({
                  time: s.time,
                  calls,
                  intervalMs: now - last,
                });
              else result.overflow = true;
            }
        }
        calls = 0;
        last = now;
        if (
          !s ||
          s.stageId !== stageId ||
          (s.mode !== "won" && s.mode !== "lost")
        )
          requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { windows, stageId },
  );
}
export async function saveStage02Sampler(
  page: Page,
  info: TestInfo,
  name = "stage02",
) {
  const result = await page.evaluate(() => (window as any).__STAGE02_RENDER__);
  expect(result.patchedMethods).toBeGreaterThan(0);
  expect(result.overflow).toBe(false);
  expect(
    result.renderer,
    "renderer was observed during normal play",
  ).toBeTruthy();
  expect(result.renderer.batchSize).toBe(4096);
  const quantile = (numbers: number[], fraction: number) => {
    const a = [...numbers].sort((a, b) => a - b);
    return a[Math.floor((a.length - 1) * fraction)] ?? 0;
  };
  const summaries = result.buckets.map((bucket: any[], i: number) => {
    expect(bucket.length, `window ${result.windows[i]}`).toBeGreaterThan(5);
    expect(bucket.some((s) => s.calls > 0)).toBe(true);
    return {
      window: result.windows[i],
      frames: bucket.length,
      drawCalls: {
        mean: bucket.reduce((a, s) => a + s.calls, 0) / bucket.length,
        p95: quantile(
          bucket.map((s) => s.calls),
          0.95,
        ),
      },
      rafIntervalMs: {
        p50: quantile(
          bucket.map((s) => s.intervalMs),
          0.5,
        ),
        p95: quantile(
          bucket.map((s) => s.intervalMs),
          0.95,
        ),
        p99: quantile(
          bucket.map((s) => s.intervalMs),
          0.99,
        ),
      },
    };
  });
  const late = result.bossPhase3 as {
    time: number;
    calls: number;
    intervalMs: number;
    missiles: number;
  }[];
  expect(late.length, "normal combat reached Boss phase three").toBeGreaterThan(
    0,
  );
  const bossPhase3 = {
    frames: late.length,
    from: late[0].time,
    to: late.at(-1)!.time,
    drawCalls: {
      mean: late.reduce((n, p) => n + p.calls, 0) / late.length,
      p95: quantile(
        late.map((p) => p.calls),
        0.95,
      ),
    },
    rafIntervalMs: {
      p50: quantile(
        late.map((p) => p.intervalMs),
        0.5,
      ),
      p95: quantile(
        late.map((p) => p.intervalMs),
        0.95,
      ),
    },
    peakVisibleMissiles: Math.max(...late.map((p) => p.missiles)),
  };
  expect(
    bossPhase3.drawCalls.p95,
    "bounded late-Boss draw submissions",
  ).toBeLessThan(160);
  const report = {
    seed: 42,
    stageId: result.stageId,
    summaries,
    bossPhase3,
    raw: result,
    limitations:
      "Single shared CI software-rendered run with video, screenshots and observer overhead. GL command counts and RAF intervals, not GPU duration or real-phone performance; no acceleration assertion.",
  };
  await info.attach(`${name}-render-sampling`, {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  await writeFile(
    `docs/${name}-render-sampling.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    name.toUpperCase() + "_RENDER_SAMPLING",
    JSON.stringify({ summaries, bossPhase3 }),
  );
}
export async function captureStage02Frame(page: Page, name: string) {
  await page.screenshot({ path: `docs/${name}.png`, timeout: 15000 });
  const data = await page.evaluate(() => (window as any).__P01_CAPTURE__());
  await writeFile(
    `docs/${name}-native.png`,
    Buffer.from(data.split(",")[1], "base64"),
  );
}
