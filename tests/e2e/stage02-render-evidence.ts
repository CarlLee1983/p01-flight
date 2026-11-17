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
export async function installStage02Sampler(page: Page) {
  await page.addInitScript((windows) => {
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
      windows,
      buckets,
      patchedMethods,
      overflow: false,
      renderer: null as unknown,
    };
    w.__STAGE02_RENDER__ = result;
    const sample = (now: number) => {
      const s = w.__P01__?.();
      if (s?.stageId === "stage-02" && s.mode === "playing") {
        result.renderer = s.renderer;
        for (let i = 0; i < windows.length; i++)
          if (s.time >= windows[i][0] && s.time < windows[i][1] && last) {
            if (buckets[i].length < 4096)
              buckets[i].push({ time: s.time, calls, intervalMs: now - last });
            else result.overflow = true;
          }
      }
      calls = 0;
      last = now;
      if (!s || s.stageId !== "stage-02" || s.time < 150)
        requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, STAGE02_PERF_WINDOWS);
}
export async function saveStage02Sampler(page: Page, info: TestInfo) {
  const result = await page.evaluate(() => (window as any).__STAGE02_RENDER__);
  expect(result.patchedMethods).toBeGreaterThan(0);
  expect(result.overflow).toBe(false);
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
  const report = {
    seed: 42,
    summaries,
    raw: result,
    limitations:
      "Single shared CI software-rendered run with video and three screenshot captures. GL command counts and RAF intervals, not GPU duration or real-phone performance; no acceleration assertion.",
  };
  await info.attach("stage02-render-sampling", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  await writeFile(
    "docs/stage02-render-sampling.json",
    JSON.stringify(report, null, 2),
  );
  console.log("STAGE02_RENDER_SAMPLING", JSON.stringify(summaries));
}
export async function captureStage02Frame(page: Page, name: string) {
  await page.screenshot({ path: `docs/${name}.png`, timeout: 15000 });
  const data = await page.evaluate(() => (window as any).__P01_CAPTURE__());
  await writeFile(
    `docs/${name}-native.png`,
    Buffer.from(data.split(",")[1], "base64"),
  );
}
