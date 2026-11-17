import { afterEach, expect, it, vi } from "vitest";
import { FlightAudio } from "../src/game/audio";
const settle = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function setup() {
  const sources: any[] = [],
    gains: any[] = [];
  const listeners = new Set<() => void>();
  const visibility = {
    hidden: false,
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  };
  const parameter = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createOscillator: vi.fn(() => {
      throw new Error("Recorded BGM must not allocate synth oscillators");
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 90 })),
    createGain: () => {
      const n = { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(n);
      return n;
    },
    createBufferSource: () => {
      const n = {
        buffer: null,
        loop: false,
        onended: null as any,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(n);
      return n;
    },
  };
  const factory = vi.fn(function () {
    return ctx;
  });
  const fetcher = vi.fn(async (_url: string, _options?: RequestInit) => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1),
  }));
  vi.stubGlobal("AudioContext", factory);
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("document", visibility);
  vi.stubEnv("BASE_URL", "/p01-preview/");
  const audio = new FlightAudio();
  return {
    audio,
    ctx,
    sources,
    gains,
    factory,
    fetcher,
    visibility,
    listeners,
  };
}
it("default FlightAudio uses recorded assets through unlock, pause/resume, Boss, new run and dispose", async () => {
  const s = setup();
  expect(s.factory).not.toHaveBeenCalled();
  await s.audio.unlock();
  await settle();
  expect(s.sources).toHaveLength(0); // Boss preload is not playback.
  s.audio.setPlaying(true);
  await settle();
  expect(s.audio.diagnostics().recorded).toMatchObject({
    track: "stage01",
    playing: true,
    activeSources: 1,
    unlocked: true,
  });
  expect(s.fetcher.mock.calls.map((c) => c[0]).sort()).toEqual([
    "/p01-preview/audio/boss.ogg",
    "/p01-preview/audio/stage01.ogg",
  ]);
  expect(s.gains[0].gain.value).toBeCloseTo(0.6 * 0.22);
  expect(s.gains[2].gain.value).toBe(1); // Player bus does not attenuate again.
  for (let i = 0; i < 40; i++) {
    s.audio.update(0.5);
    s.audio.setMusicContext("flight");
  }
  await settle();
  expect(s.sources).toHaveLength(1);
  expect(s.ctx.createOscillator).not.toHaveBeenCalled();
  s.ctx.currentTime = 8;
  s.audio.setPlaying(false);
  s.ctx.currentTime = 30;
  expect(s.audio.diagnostics().recorded).toMatchObject({
    playing: false,
    activeSources: 0,
    positionSeconds: 8,
  });
  s.audio.setPlaying(true);
  await settle();
  expect(s.sources[1].start).toHaveBeenCalledWith(0, 8);
  s.audio.setMusicContext("boss");
  await settle();
  expect(s.audio.diagnostics().recorded).toMatchObject({
    track: "boss",
    activeSources: 2,
    positionSeconds: 0,
  });
  expect(s.sources[1].stop).toHaveBeenCalledWith(30.25);
  s.audio.resetMusic();
  s.audio.setPlaying(true);
  await settle();
  expect(s.audio.diagnostics().recorded).toMatchObject({
    track: "stage01",
    activeSources: 1,
    positionSeconds: 0,
  });
  expect(s.fetcher).toHaveBeenCalledTimes(2);
  s.audio.setVolumes(0, 0);
  expect(s.gains[0].gain.value).toBe(0);
  expect(s.gains[1].gain.value).toBe(0);
  s.audio.setVolumes(0.5, 0.8);
  expect(s.gains[0].gain.value).toBeCloseTo(0.11);
  s.audio.dispose();
  await settle();
  expect(s.audio.diagnostics()).toMatchObject({
    playing: false,
    recorded: null,
  });
  expect(s.sources.every((n) => n.disconnect.mock.calls.length === 1)).toBe(
    true,
  );
  expect(s.listeners.size).toBe(0);
  expect(s.ctx.close).toHaveBeenCalledOnce();
});
it("default hidden transition cancels a pending stage decode and requires explicit resume", async () => {
  const s = setup();
  await s.audio.unlock();
  await settle();
  let finish!: (buffer: any) => void;
  s.ctx.decodeAudioData.mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  s.audio.setPlaying(true);
  await settle();
  s.visibility.hidden = true;
  for (const listener of s.listeners) listener();
  finish({ duration: 90 });
  await settle();
  expect(s.sources).toHaveLength(0);
  expect(s.audio.diagnostics().playing).toBe(false);
  s.visibility.hidden = false;
  for (const listener of s.listeners) listener();
  await settle();
  expect(s.sources).toHaveLength(0);
  s.audio.setPlaying(true);
  await settle();
  expect(s.sources).toHaveLength(1);
  s.audio.dispose();
});
it("default failed downloads report failure, while disposal during decode prevents playback", async () => {
  const s = setup();
  s.fetcher.mockRejectedValue(new Error("network"));
  await s.audio.unlock();
  s.audio.setPlaying(true);
  await settle();
  expect(s.audio.diagnostics().recorded).toMatchObject({
    loadFailed: true,
    activeSources: 0,
  });
  expect(s.fetcher.mock.calls.map((c) => c[0])).toContain(
    "/p01-preview/audio/stage01.mp3",
  );
  s.audio.dispose();
  const pending = setup();
  await pending.audio.unlock();
  await settle();
  let finish!: (buffer: any) => void;
  pending.ctx.decodeAudioData.mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  pending.audio.setPlaying(true);
  await settle();
  pending.audio.dispose();
  finish({ duration: 90 });
  await settle();
  expect(pending.sources).toHaveLength(0);
  expect(pending.listeners.size).toBe(0);
});
it("reset while stopped does not start BGM until playing is requested", async () => {
  const s = setup();
  await s.audio.unlock();
  s.audio.resetMusic();
  await settle();
  expect(s.audio.diagnostics().playing).toBe(false);
  expect(s.audio.diagnostics().recorded?.activeSources).toBe(0);
  s.audio.setPlaying(true);
  await settle();
  expect(s.audio.diagnostics().recorded?.activeSources).toBe(1);
  s.audio.dispose();
});
