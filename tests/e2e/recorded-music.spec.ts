import { test, expect, webkit } from "@playwright/test";

async function decodeTracks(page: any) {
  return page.evaluate(async () => {
    const out = [];
    for (const track of ["stage01", "boss"]) {
      for (const format of ["ogg", "mp3"]) {
        const ctx = new OfflineAudioContext(2, 44100, 44100);
        const response = await fetch(`audio/${track}.${format}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        // Render actual end -> start boundary, not an invented mock audio buffer.
        const gain = ctx.createGain();
        gain.gain.value = 0.132;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0, buffer.duration - 0.25);
        const pcm = (await ctx.startRendering()).getChannelData(0);
        let peak = 0,
          sum = 0;
        for (const value of pcm) {
          peak = Math.max(peak, Math.abs(value));
          sum += value * value;
        }
        out.push({
          track,
          format,
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
          peak,
          rms: Math.sqrt(sum / pcm.length),
          seamDelta: Math.abs(pcm[11025] - pcm[11024]),
        });
        source.disconnect();
        gain.disconnect();
      }
    }
    return out;
  });
}

test("licensed files decode and loop through real PCM without silent output or single-track clipping", async ({
  page,
}, info) => {
  await page.goto("/");
  const metrics = await decodeTracks(page);
  expect(metrics).toHaveLength(4);
  for (const m of metrics) {
    expect(m.duration).toBeGreaterThan(80);
    expect(m.duration).toBeLessThan(95);
    expect(m.channels).toBe(2);
    expect(m.rms).toBeGreaterThan(0.001);
    expect(m.peak).toBeLessThan(0.2);
  }
  await info.attach("licensed-audio-decode-and-loop", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  await page.goto("/audio-preview.html");
  await page.screenshot({ path: "docs/music-preview.png" });
  expect(await page.locator("audio[autoplay]").count()).toBe(0);
  expect(await page.locator("audio").count()).toBe(2);
  await expect(
    page.getByText("Patrick de Arteaga", { exact: true }),
  ).toBeVisible();
});

test("WebKit decodes the MP3 fallback without requiring an OGG support claim", async ({}, info) => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4173/");
    const result = await page.evaluate(async () => {
      const context = new OfflineAudioContext(2, 44100, 44100);
      const result = [];
      for (const track of ["stage01", "boss"]) {
        const response = await fetch(`audio/${track}.mp3`);
        const buffer = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        result.push({
          track,
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
        });
      }
      return result;
    });
    expect(result).toHaveLength(2);
    for (const m of result) expect(m.duration).toBeGreaterThan(80);
    await info.attach("webkit-mp3-decode", {
      body: JSON.stringify(result),
      contentType: "application/json",
    });
  } finally {
    await browser.close();
  }
});

// Actual default FlightAudio path, not only an isolated codec decode.
test("unavailable OGG falls back to MP3 in the running game", async ({
  page,
}) => {
  const mp3: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".mp3")) mp3.push(r.url());
  });
  await page.route("**/audio/*.ogg", (route) =>
    route.fulfill({ status: 404, body: "not available" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "開始飛行" }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as any).__P01__()?.audio?.recorded?.activeSources,
        ),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  expect(mp3.some((u) => u.endsWith("stage01.mp3"))).toBe(true);
  await page.keyboard.press("p");
  expect(
    await page.evaluate(
      () => (window as any).__P01__()?.audio?.recorded?.activeSources,
    ),
  ).toBe(0);
});
