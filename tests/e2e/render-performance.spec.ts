import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

// Measure the built production client, without video capture or a frame-by-frame
// automation round trip. The only gameplay input is the same real held Space key.
test.use({ video: "off" });
type Variant = "global-single" | "quad-single" | "normal";
type Sample = { gameTime: number; intervalMs: number; calls: number };
const windows = [
  [10, 15],
  [20, 25],
] as const;
function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))
    ] ?? 0
  );
}
function summarize(samples: Sample[]) {
  const intervals = samples.map((s) => s.intervalMs),
    calls = samples.map((s) => s.calls);
  return {
    frames: samples.length,
    intervalMs: {
      p50: percentile(intervals, 0.5),
      p95: percentile(intervals, 0.95),
      p99: percentile(intervals, 0.99),
    },
    drawCalls: {
      mean: calls.reduce((a, b) => a + b, 0) / Math.max(1, calls.length),
      p95: percentile(calls, 0.95),
    },
    longFramesOver50ms: intervals.filter((v) => v > 50).length,
  };
}
function replaceExactlyOnce(
  source: string,
  pattern: RegExp,
  replacement: string,
  label: string,
) {
  const matches = source.match(new RegExp(pattern.source, "g")) ?? [];
  expect(
    matches.length,
    `Production bundle marker ${label} must be unique`,
  ).toBe(1);
  return source.replace(pattern, replacement);
}

test("production renderer comparison: Graphics batching vs local quad workaround", async ({
  browser,
}, testInfo) => {
  test.setTimeout(420000);
  const results: Record<string, unknown> = {};
  const summaries: Record<string, ReturnType<typeof summarize>[]> = {};
  for (const variant of [
    "global-single",
    "quad-single",
    "normal",
  ] as Variant[]) {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width: 500, height: 700 },
      deviceScaleFactor: 1,
    });
    let patched = 0;
    let originalBundleSha256 = "",
      variantBundleSha256 = "";
    try {
      await context.route("**/assets/*.js", async (route) => {
        const response = await route.fetch();
        let source = await response.text();
        originalBundleSha256 = createHash("sha256")
          .update(source)
          .digest("hex");
        // Deliberately fail closed when the compiler/source changes these unique
        // application markers; never patch Phaser's own node registry strings.
        source = replaceExactlyOnce(
          source,
          /batchSize:4096/,
          `batchSize:${variant === "global-single" ? 1 : 4096}`,
          "render batch config",
        );
        source = replaceExactlyOnce(
          source,
          /"BatchHandler","BatchHandlerQuadSingle"/,
          `"BatchHandler","${variant === "quad-single" ? "BatchHandlerQuadSingle" : "BatchHandlerQuad"}"`,
          "application quad role",
        );
        variantBundleSha256 = createHash("sha256").update(source).digest("hex");
        patched++;
        await route.fulfill({ response, body: source });
      });
      await context.addInitScript(() => {
        const w = window as any;
        let calls = 0,
          last = 0;
        const buckets: any[][] = [[], []];
        let overflow = false,
          patchedMethods = 0;
        for (const name of [
          "WebGLRenderingContext",
          "WebGL2RenderingContext",
        ]) {
          const prototype = w[name]?.prototype;
          if (!prototype) continue;
          for (const method of [
            "drawElements",
            "drawArrays",
            "drawElementsInstanced",
            "drawArraysInstanced",
          ]) {
            const descriptor = Object.getOwnPropertyDescriptor(
              prototype,
              method,
            );
            if (!descriptor || typeof descriptor.value !== "function") continue;
            const original = descriptor.value;
            Object.defineProperty(prototype, method, {
              ...descriptor,
              value: function (...args: any[]) {
                calls++;
                return original.apply(this, args);
              },
            });
            patchedMethods++;
          }
        }
        w.__RENDER_PERF__ = {
          buckets,
          get overflow() {
            return overflow;
          },
          patchedMethods,
          done: false,
        };
        const sample = (now: number) => {
          const snapshot = w.__P01__?.();
          const intervalMs = last ? now - last : 0;
          if (snapshot?.mode === "playing") {
            const time = snapshot.time;
            const index =
              time >= 10 && time < 15 ? 0 : time >= 20 && time < 25 ? 1 : -1;
            if (index >= 0 && last) {
              if (buckets[index].length < 4096)
                buckets[index].push({ gameTime: time, intervalMs, calls });
              else overflow = true;
            }
          }
          calls = 0;
          last = now;
          if (
            snapshot &&
            (snapshot.time >= 25 ||
              snapshot.mode === "lost" ||
              snapshot.mode === "won")
          ) {
            w.__RENDER_PERF__.done = true;
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await page.getByRole("button", { name: "開始飛行" }).click();
      await page.keyboard.down("Space");
      try {
        await page.waitForFunction(
          () => (window as any).__RENDER_PERF__?.done,
          undefined,
          { timeout: 120000, polling: 250 },
        );
      } finally {
        await page.keyboard.up("Space");
      }
      const measured = await page.evaluate(() => {
        const p = (window as any).__RENDER_PERF__,
          s = (window as any).__P01__();
        return {
          buckets: p.buckets,
          overflow: p.overflow,
          patchedMethods: p.patchedMethods,
          final: {
            mode: s.mode,
            time: s.time,
            hp: s.hp,
            shots: s.shots,
            score: s.score,
            renderer: s.renderer,
            renderMetrics: s.renderMetrics,
          },
        };
      });
      summaries[variant] = measured.buckets.map((samples: Sample[]) =>
        summarize(samples),
      );
      results[variant] = {
        originalBundleSha256,
        variantBundleSha256,
        windows: windows.map((span, i) => ({
          gameSeconds: span,
          summary: summaries[variant][i],
          samples: measured.buckets[i],
        })),
        ...measured.final,
      };
      await testInfo.attach(`renderer-${variant}`, {
        body: JSON.stringify(results[variant], null, 2),
        contentType: "application/json",
      });
      expect(patched).toBe(1);
      expect(measured.final.renderer.batchSize).toBe(
        variant === "global-single" ? 1 : 4096,
      );
      expect(measured.final.renderer.hudBatchRole).toBe(
        variant === "quad-single"
          ? "BatchHandlerQuadSingle"
          : "BatchHandlerQuad",
      );
      expect(errors).toEqual([]);
      expect(measured.patchedMethods).toBeGreaterThanOrEqual(2);
      expect(measured.overflow).toBe(false);
      expect(measured.final.mode).toBe("playing");
      expect(measured.final.time).toBeGreaterThanOrEqual(25);
      for (const summary of summaries[variant]) {
        expect(summary.frames).toBeGreaterThan(5);
        expect(summary.drawCalls.mean).toBeGreaterThan(0);
      }
      // Optional visual evidence is outside both sampling windows and no video
      // is enabled. It must not be interpreted as continuous visual validation.
      await page.screenshot({
        path: testInfo.outputPath(`renderer-${variant}-after-measurement.png`),
      });
    } finally {
      await context.close();
    }
  }
  await testInfo.attach("renderer-comparison", {
    body: JSON.stringify(
      {
        viewport: { width: 500, height: 700 },
        warmupGameSeconds: [0, 10],
        windows,
        summaries,
        limitations:
          "CPU rAF intervals and intercepted WebGL call counts, not GPU timings; instrumentation and read-only snapshot allocation add common overhead; same held-key route, software CI renderer may differ from user GPU; screenshots occur after measurement.",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  console.log("RENDERER_COMPARISON", JSON.stringify(summaries));
  for (let i = 0; i < windows.length; i++) {
    // Relative API-call reduction, not a fixed CI frame-rate or GPU claim.
    expect(summaries["quad-single"][i].drawCalls.mean).toBeLessThan(
      summaries["global-single"][i].drawCalls.mean * 0.8,
    );
    expect(summaries.normal[i].drawCalls.mean).toBeLessThan(
      summaries["global-single"][i].drawCalls.mean * 0.8,
    );
  }
});
