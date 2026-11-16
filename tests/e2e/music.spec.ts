import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
test("original score renders six distinct unclipped sections to real PCM", async ({
  page,
}, testInfo) => {
  const bundled = await build({
    entryPoints: ["src/game/music-preview.ts"],
    bundle: true,
    format: "iife",
    globalName: "MusicPreview",
    write: false,
  });
  await page.goto("/");
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const r = await (window as any).MusicPreview.renderMusicPreview();
    const bytes = new Uint8Array(r.wav);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 16384)
      binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return { ...r, wav: btoa(binary) };
  });
  expect(result.stats).toHaveLength(6);
  expect(result.scheduled).toBeGreaterThan(100);
  expect(result.ended).toBe(result.scheduled);
  for (const s of result.stats) {
    expect(s.rms).toBeGreaterThan(0.001);
    expect(s.peak).toBeLessThan(0.95);
    expect(s.nonzero / s.samples).toBeGreaterThan(0.5);
  }
  expect(
    new Set(result.stats.map((s: any) => s.rms.toFixed(5))).size,
  ).toBeGreaterThan(3);
  await writeFile(
    testInfo.outputPath("original-score.wav"),
    Buffer.from(result.wav, "base64"),
  );
  await writeFile(
    testInfo.outputPath("score-analysis.json"),
    JSON.stringify({ ...result, wav: undefined }, null, 2),
  );
  console.log(
    "ORIGINAL_SCORE_PCM",
    JSON.stringify({ ...result, wav: undefined }),
  );
});
