import { expect, it, vi } from "vitest";
import { RecordedMusic, taperLoopEdge } from "../src/game/recorded-music";
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function setup() {
  const gains: any[] = [],
    sources: any[] = [];
  const ctx: any = {
    state: "running",
    currentTime: 0,
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 60 })),
    createGain: () => {
      const node = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gains.push(node);
      return node;
    },
    createBufferSource: () => {
      const node = {
        buffer: null,
        loop: false,
        onended: null as any,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(node);
      return node;
    },
  };
  let listener = () => {};
  const visibility: any = {
    hidden: false,
    addEventListener: vi.fn((_e, f) => {
      listener = f;
    }),
    removeEventListener: vi.fn(),
  };
  const fetcher = vi.fn(async (_url: string, _options?: RequestInit) => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1),
  }));
  const player = new RecordedMusic(ctx, {} as AudioNode, {
    fetch: fetcher as any,
    visibility,
  });
  return {
    player,
    ctx,
    gains,
    sources,
    visibility,
    fetcher,
    hidden() {
      visibility.hidden = true;
      listener();
    },
  };
}
it("preload and play do not start sources before a gesture; caches both tracks", async () => {
  const s = setup();
  await s.player.preload("stage01");
  await s.player.preload("stage01");
  await s.player.preload("boss");
  s.player.play();
  await flush();
  expect(s.sources).toHaveLength(0);
  await s.player.unlockFromGesture();
  await flush();
  expect(s.sources).toHaveLength(1);
  expect(s.sources[0].loop).toBe(true);
  expect(s.fetcher).toHaveBeenCalledTimes(2);
  expect(s.fetcher.mock.calls[0][0]).toBe("audio/stage01.ogg");
  s.player.dispose();
});
it("falls back to mp3 on unsupported ogg and remains silent on complete failure", async () => {
  const s = setup();
  s.ctx.decodeAudioData.mockRejectedValueOnce(new Error("codec"));
  await s.player.unlockFromGesture();
  s.player.play();
  await flush();
  expect(s.fetcher.mock.calls.map((c: any) => c[0])).toEqual([
    "audio/stage01.ogg",
    "audio/stage01.mp3",
  ]);
  expect(s.sources).toHaveLength(1);
  s.player.dispose();
  const failed = setup();
  failed.fetcher.mockRejectedValue(new Error("offline"));
  await failed.player.unlockFromGesture();
  failed.player.play();
  await flush();
  expect(failed.sources).toHaveLength(0);
  expect(failed.fetcher).toHaveBeenCalledTimes(2);
  failed.player.dispose();
});
it("pause resumes the offset, restart clears it, mute affects live gain", async () => {
  const s = setup();
  await s.player.unlockFromGesture();
  s.player.play();
  await flush();
  s.ctx.currentTime = 9;
  s.player.pause();
  expect(s.sources[0].disconnect).toHaveBeenCalledOnce();
  s.ctx.currentTime = 35;
  s.player.play();
  await flush();
  expect(s.sources[1].start).toHaveBeenCalledWith(0, 9);
  s.player.setVolume(0.4);
  expect(s.gains[0].gain.value).toBe(0.4);
  s.player.setMuted(true);
  expect(s.gains[0].gain.value).toBe(0);
  s.player.setMuted(false);
  expect(s.gains[0].gain.value).toBe(0.4);
  s.player.setVolume(NaN);
  expect(s.gains[0].gain.value).toBe(0);
  s.player.restart();
  await flush();
  expect(s.sources[2].start).toHaveBeenCalledWith(0, 0);
  s.player.dispose();
});
it("crossfades only old and new; rapid transitions retire older tails; dispose cleans all", async () => {
  const s = setup();
  await s.player.unlockFromGesture();
  s.player.play();
  await flush();
  s.ctx.currentTime = 5;
  s.player.play("boss");
  await flush();
  expect(s.sources[0].stop).toHaveBeenCalledWith(5.25);
  expect(s.gains[2].gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 5.25);
  s.player.play("stage01");
  await flush();
  expect(s.sources[0].disconnect).toHaveBeenCalledOnce();
  expect(
    s.sources.filter((n) => n.disconnect.mock.calls.length === 0),
  ).toHaveLength(2);
  s.sources[1].onended();
  expect(
    s.sources.filter((n) => n.disconnect.mock.calls.length === 0),
  ).toHaveLength(1);
  s.player.dispose();
  s.player.dispose();
  expect(s.sources.every((n) => n.disconnect.mock.calls.length === 1)).toBe(
    true,
  );
  expect(s.gains[0].disconnect).toHaveBeenCalledOnce();
  expect(s.visibility.removeEventListener).toHaveBeenCalledOnce();
});
it("hidden cancels pending decode and does not automatically resume when visible", async () => {
  const s = setup();
  let resolve!: (value: any) => void;
  s.ctx.decodeAudioData.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await s.player.unlockFromGesture();
  s.player.play();
  await flush();
  s.hidden();
  resolve({ duration: 60 });
  await flush();
  expect(s.sources).toHaveLength(0);
  s.visibility.hidden = false;
  await flush();
  expect(s.sources).toHaveLength(0);
  s.player.play();
  await flush();
  expect(s.sources).toHaveLength(1);
  s.player.dispose();
});
it("dispose during decode or unlock cannot revive audio and aborts network", async () => {
  const s = setup();
  let resolve!: (value: any) => void;
  s.ctx.decodeAudioData.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await s.player.unlockFromGesture();
  s.player.play();
  await flush();
  s.player.dispose();
  resolve({ duration: 60 });
  await flush();
  expect(s.sources).toHaveLength(0);
  expect((s.fetcher.mock.calls[0] as any)[1].signal.aborted).toBe(true);
  const suspended = setup();
  suspended.ctx.state = "suspended";
  let resume!: () => void;
  suspended.ctx.resume.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resume = r;
      }),
  );
  const unlocking = suspended.player.unlockFromGesture();
  suspended.player.dispose();
  resume();
  expect(await unlocking).toBe(false);
  expect(suspended.sources).toHaveLength(0);
});
it("late stage decode cannot overwrite a newer boss selection", async () => {
  const s = setup();
  let stage!: (value: any) => void;
  s.ctx.decodeAudioData.mockImplementationOnce(
    () =>
      new Promise((r) => {
        stage = r;
      }),
  );
  await s.player.unlockFromGesture();
  s.player.play("stage01");
  await flush();
  s.player.play("boss");
  await flush();
  expect(s.sources).toHaveLength(1);
  stage({ duration: 60 });
  await flush();
  expect(s.sources).toHaveLength(1);
  s.player.play("boss");
  await s.player.unlockFromGesture();
  await flush();
  expect(s.sources).toHaveLength(1);
  s.hidden();
  expect(s.sources[0].disconnect).toHaveBeenCalledOnce();
  s.player.dispose();
});
it("blocked unlock and source-start failure do not escape or leave attached nodes", async () => {
  const s = setup();
  s.ctx.state = "suspended";
  s.ctx.resume.mockRejectedValueOnce(new Error("gesture required"));
  expect(await s.player.unlockFromGesture()).toBe(false);
  s.player.play();
  await flush();
  expect(s.sources).toHaveLength(0);
  s.ctx.state = "running";
  const original = s.ctx.createBufferSource;
  s.ctx.createBufferSource = () => {
    const node = original();
    node.start.mockImplementation(() => {
      throw new Error("closed");
    });
    return node;
  };
  await s.player.unlockFromGesture();
  await flush();
  expect(s.sources).toHaveLength(1);
  expect(s.sources[0].disconnect).toHaveBeenCalledOnce();
  s.player.dispose();
});
it("diagnostics distinguish intent/loading/failure and track both real API selections", async () => {
  const s = setup();
  expect(s.player.diagnostics()).toEqual({
    track: "stage01",
    activeTrack: null,
    playing: false,
    activeSources: 0,
    positionSeconds: 0,
    durationSeconds: 0,
    loadedTracks: [],
    loadFailed: false,
    unlocked: false,
  });
  s.player.play();
  expect(s.player.diagnostics()).toMatchObject({
    playing: true,
    activeSources: 0,
    loadFailed: false,
    unlocked: false,
  });
  await s.player.unlockFromGesture();
  await flush();
  s.ctx.currentTime = 12;
  expect(s.player.diagnostics()).toMatchObject({
    track: "stage01",
    playing: true,
    activeSources: 1,
    positionSeconds: 12,
    durationSeconds: 60,
    loadedTracks: ["stage01"],
    loadFailed: false,
    unlocked: true,
  });
  s.player.pause();
  s.ctx.currentTime = 40;
  expect(s.player.diagnostics()).toMatchObject({
    playing: false,
    activeSources: 0,
    positionSeconds: 12,
  });
  s.player.play();
  await flush();
  s.ctx.currentTime = 43;
  expect(s.player.diagnostics().positionSeconds).toBe(15);
  s.player.play("boss");
  await flush();
  expect(s.player.diagnostics()).toMatchObject({
    track: "boss",
    playing: true,
    activeSources: 2,
    positionSeconds: 0,
    durationSeconds: 60,
    loadedTracks: ["stage01", "boss"],
    loadFailed: false,
  });
  s.player.restart();
  await flush();
  expect(s.player.diagnostics()).toMatchObject({
    track: "stage01",
    activeSources: 1,
    positionSeconds: 0,
  });
  s.player.dispose();
  expect(s.player.diagnostics()).toMatchObject({
    playing: false,
    activeSources: 0,
    loadedTracks: [],
    unlocked: false,
  });
  const f = setup();
  f.fetcher.mockRejectedValue(new Error("offline"));
  await f.player.unlockFromGesture();
  f.player.play();
  expect(f.player.diagnostics().loadFailed).toBe(false);
  await flush();
  expect(f.player.diagnostics()).toMatchObject({
    loadFailed: true,
    activeSources: 0,
    loadedTracks: [],
  });
  f.fetcher.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1),
  });
  f.player.play("boss");
  await flush();
  expect(f.player.diagnostics()).toMatchObject({
    track: "boss",
    loadFailed: false,
    loadedTracks: ["boss"],
    activeSources: 1,
  });
  f.player.dispose();
});

it("tapers only five millisecond loop edges while preserving the body", () => {
  const pcm = new Float32Array(44100).fill(0.5);
  taperLoopEdge(pcm, 44100);
  expect(pcm[0]).toBe(0);
  expect(pcm.at(-1)).toBe(0);
  expect(pcm[220]).toBe(0.5);
  expect(pcm[pcm.length - 221]).toBe(0.5);
  expect(pcm[110]).toBeGreaterThan(0);
  expect(pcm[110]).toBeLessThan(0.5);
});
