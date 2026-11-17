import { afterEach, describe, expect, it, vi } from "vitest";
import { FlightAudio } from "../src/game/audio";
class Param {
  value = 1;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class Gain {
  gain = new Param();
  connect = vi.fn();
  disconnect = vi.fn();
}
class Osc {
  frequency = new Param();
  type = "sine";
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn((_when?: number) => {});
  stop = vi.fn((_when?: number) => {});
}
class Context {
  static instances: Context[] = [];
  state = "suspended";
  currentTime = 0;
  destination = {};
  gains: Gain[] = [];
  oscillators: Osc[] = [];
  constructor() {
    Context.instances.push(this);
  }
  createGain() {
    const g = new Gain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new Osc();
    this.oscillators.push(o);
    return o;
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Context.instances = [];
});
describe("original procedural audio", () => {
  it("does not construct audio until explicit gesture unlock; pauses stop and disconnect voices", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    a.setPlaying(true);
    a.update(1);
    a.play("shot");
    expect(Context.instances).toHaveLength(0);
    await a.unlock();
    const ctx = Context.instances[0];
    a.update(0.016);
    a.play("shot");
    expect(a.diagnostics().activeVoices).toBe(7);
    a.setPlaying(false);
    expect(a.diagnostics().activeVoices).toBe(0);
    expect(
      ctx.oscillators.every((o) => o.disconnect.mock.calls.length === 1),
    ).toBe(true);
    a.update(1);
    expect(a.diagnostics().activeVoices).toBe(0);
    a.dispose();
  });
  it("applies volume to live buses, zero mutes without schema changes, and throttles rapid sounds", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    a.setVolumes(0.2, 0.3);
    await a.unlock();
    const ctx = Context.instances[0];
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.044);
    expect(ctx.gains[1].gain.value).toBeCloseTo(0.096);
    a.play("shot");
    a.play("shot");
    expect(ctx.oscillators).toHaveLength(1);
    ctx.currentTime = 0.1;
    a.play("shot");
    expect(ctx.oscillators).toHaveLength(2);
    a.setVolumes(0, 0);
    expect(ctx.gains[0].gain.value).toBe(0);
    expect(ctx.gains[1].gain.value).toBe(0);
    a.play("bomb");
    a.setPlaying(true);
    a.update(0.1);
    expect(ctx.oscillators).toHaveLength(2);
    a.dispose();
  });
  it("caps voices and cleans nodes on natural end", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    const ctx = Context.instances[0];
    for (let i = 0; i < 20; i++) {
      ctx.currentTime += 1;
      a.play("won");
    }
    expect(a.diagnostics().activeVoices).toBe(16);
    ctx.oscillators[0].onended!();
    expect(a.diagnostics().activeVoices).toBe(15);
    expect(ctx.oscillators[0].disconnect).toHaveBeenCalledOnce();
    a.dispose();
  });
  it("unsupported or denied audio does not throw and can retry unlock", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const a = new FlightAudio();
    await expect(a.unlock()).resolves.toBeUndefined();
    a.play("shot");
    expect(a.diagnostics().unavailable).toBe(true);
    a.dispose();
    class Denied extends Context {
      resume = vi.fn(async () => {
        throw Error("blocked");
      });
    }
    vi.stubGlobal("AudioContext", Denied);
    const b = new FlightAudio();
    await expect(b.unlock()).resolves.toBeUndefined();
    expect(b.diagnostics().unavailable).toBe(true);
    b.play("won");
    expect(b.diagnostics().activeVoices).toBe(0);
    b.dispose();
  });
  it("hiding the document stops active music and effects", async () => {
    let hidden = false;
    let handler: (() => void) | undefined;
    vi.stubGlobal("document", {
      get hidden() {
        return hidden;
      },
      addEventListener: (_: string, h: () => void) => {
        handler = h;
      },
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    a.setPlaying(true);
    a.update(0.1);
    expect(a.diagnostics().activeVoices).toBeGreaterThan(0);
    hidden = true;
    handler!();
    expect(a.diagnostics().activeVoices).toBe(0);
    a.play("bomb");
    expect(a.diagnostics().activeVoices).toBe(0);
    a.dispose();
  });
  it("beam is a layered sustained buzz rather than the shot chirp", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    const ctx = Context.instances[0];
    a.play("shot");
    a.play("beam");
    a.play("beam");
    expect(ctx.oscillators.map((o) => o.type)).toEqual([
      "triangle",
      "sawtooth",
      "sine",
    ]);
    expect(ctx.oscillators[0].stop).toHaveBeenCalledWith(0.075);
    expect(ctx.oscillators[1].stop).toHaveBeenCalledWith(0.19);
    expect(ctx.gains[3].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.075,
      0.025,
    );
    a.dispose();
  });
  it("score changes section on a bar boundary and pauses retain musical position", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    const ctx = Context.instances[0];
    a.setPlaying(true);
    a.update(0.01);
    expect(a.diagnostics().musicSection).toBe("intro");
    expect(ctx.oscillators).toHaveLength(6);
    const stopCalls = ctx.oscillators.map((o) => o.stop.mock.calls.length);
    a.setIntensity(2);
    expect(ctx.oscillators.map((o) => o.stop.mock.calls.length)).toEqual(
      stopCalls,
    );
    a.update(0.1);
    expect(a.diagnostics().musicSection).toBe("intro");
    a.setPlaying(false);
    const step = a.diagnostics().musicStep;
    a.update(10);
    expect(a.diagnostics().musicStep).toBe(step);
    a.setPlaying(true);
    expect(a.diagnostics().musicStep).toBe(step);
    for (let i = 0; i < 120; i++) {
      Context.instances[0].currentTime += 1 / 60;
      a.update(1 / 60);
    }
    expect(a.diagnostics().musicSection).toBe("boss");
    a.resetMusic();
    expect(a.diagnostics().musicStep).toBe(0);
    expect(a.diagnostics().activeVoices).toBe(0);
    a.dispose();
  });
  it("leaves warning voice space during fire and temporarily suppresses routine sounds", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    const ctx = Context.instances[0];
    for (let i = 0; i < 20; i++) {
      ctx.currentTime += 0.2;
      a.play("beam");
    }
    expect(a.diagnostics().activeVoices).toBe(14);
    a.play("hurt");
    expect(a.diagnostics().activeVoices).toBe(16);
    const total = ctx.oscillators.length;
    ctx.oscillators[0].onended!();
    ctx.oscillators[1].onended!();
    ctx.currentTime += 0.1;
    a.play("shot");
    a.play("explode");
    expect(ctx.oscillators).toHaveLength(total);
    ctx.oscillators[2].onended!();
    ctx.currentTime += 0.4;
    a.play("shot");
    expect(ctx.oscillators).toHaveLength(total + 1);
    a.dispose();
  });
  it("missile uses a low rising launch cue with its own cooldown and mute", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    const ctx = Context.instances[0];
    a.play("missile");
    a.play("missile");
    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.oscillators[0].type).toBe("triangle");
    expect(ctx.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      48,
      0,
    );
    expect(
      ctx.oscillators[0].frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(140, 0.2);
    ctx.currentTime = 0.23;
    a.play("missile");
    expect(ctx.oscillators).toHaveLength(2);
    a.setVolumes(0, 0);
    ctx.currentTime = 0.5;
    a.play("missile");
    expect(ctx.oscillators).toHaveLength(2);
    a.dispose();
  });
  it.each([30, 60, 120])(
    "score tempo stays stable at %i FPS and all ended nodes release",
    async (fps) => {
      vi.stubGlobal("AudioContext", Context);
      const a = new FlightAudio();
      await a.unlock();
      const ctx = Context.instances[0];
      a.setPlaying(true);
      for (let i = 0; i < 75 * fps; i++) {
        ctx.currentTime = i / fps;
        for (const o of ctx.oscillators) {
          const ending = o.stop.mock.calls[0]?.[0] as number | undefined;
          if (ending !== undefined && ending <= ctx.currentTime && o.onended)
            o.onended();
        }
        a.update(1 / fps);
        expect(a.diagnostics().activeVoices).toBeLessThanOrEqual(12);
      }
      expect(a.diagnostics().musicStep).toBeGreaterThanOrEqual(659);
      expect(a.diagnostics().musicStep).toBeLessThanOrEqual(662);
      a.setPlaying(false);
      expect(a.diagnostics().activeVoices).toBe(0);
      expect(
        ctx.oscillators.every((o) => o.disconnect.mock.calls.length === 1),
      ).toBe(true);
      a.dispose();
    },
  );
  it("explicit encounter context overrides legacy intensity and exposes actual scheduled notes", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    a.setPlaying(true);
    a.setIntensity(2);
    a.setMusicContext("flight");
    a.update(0.01);
    expect(a.diagnostics().musicSection).toBe("intro");
    expect(a.diagnostics().notesScheduled).toBe(6);
    a.setMusicContext("pressure");
    for (let i = 0; i < 120; i++) {
      Context.instances[0].currentTime += 1 / 60;
      a.update(1 / 60);
    }
    expect(a.diagnostics().musicSection).toBe("assault");
    a.setMusicContext("recovery");
    for (let i = 0; i < 120; i++) {
      Context.instances[0].currentTime += 1 / 60;
      a.update(1 / 60);
    }
    expect(a.diagnostics().musicSection).toBe("breather");
    a.setMusicContext("boss");
    for (let i = 0; i < 120; i++) {
      Context.instances[0].currentTime += 1 / 60;
      a.update(1 / 60);
    }
    expect(a.diagnostics().musicSection).toBe("boss");
    expect(a.diagnostics().sectionTransitionCount).toBe(3);
    a.setVolumes(0, 0);
    const count = a.diagnostics().notesScheduled;
    for (let i = 0; i < 120; i++) {
      Context.instances[0].currentTime += 1 / 60;
      a.update(1 / 60);
    }
    expect(a.diagnostics().notesScheduled).toBe(count);
    a.resetMusic();
    expect(a.diagnostics().notesScheduled).toBe(0);
    expect(a.diagnostics().sectionTransitionCount).toBe(0);
    a.dispose();
  });
  it.each([16, 5, 2])(
    "AudioContext lookahead remains 132 BPM with %i FPS render updates",
    async (fps) => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      vi.stubGlobal("AudioContext", Context);
      const a = new FlightAudio();
      await a.unlock();
      const ctx = Context.instances[0];
      Object.defineProperty(ctx, "currentTime", {
        get: () => Date.now() / 1000,
      });
      const cleanup = setInterval(() => {
        for (const o of ctx.oscillators) {
          const end = o.stop.mock.calls[0]?.[0];
          if (end !== undefined && end <= ctx.currentTime && o.onended)
            o.onended();
        }
      }, 10);
      a.setPlaying(true);
      a.update(0);
      for (let i = 0; i < fps * 8; i++) {
        vi.advanceTimersByTime(1000 / fps);
        a.update(1 / fps);
      }
      expect(a.diagnostics().musicStep).toBeGreaterThanOrEqual(71);
      expect(a.diagnostics().musicStep).toBeLessThanOrEqual(72);
      expect(a.diagnostics().queuedMusicSteps).toBeLessThanOrEqual(3);
      // Notes are scheduled ahead at the AudioContext grid, not quantized to frames.
      const starts = ctx.oscillators.flatMap((o) =>
        o.start.mock.calls.map((args) => args[0] as number),
      );
      expect(
        starts.some((t) => Math.abs(t * fps - Math.round(t * fps)) > 0.1),
      ).toBe(true);
      for (const t of starts)
        expect((t - 0.01) / (60 / 132 / 4)).toBeCloseTo(
          Math.round((t - 0.01) / (60 / 132 / 4)),
          5,
        );
      a.setPlaying(false);
      const step = a.diagnostics().musicStep;
      vi.advanceTimersByTime(10000);
      expect(a.diagnostics().musicStep).toBe(step);
      a.setPlaying(true);
      a.update(0);
      expect(a.diagnostics().musicStep - step).toBeLessThanOrEqual(2);
      a.dispose();
      clearInterval(cleanup);
    },
  );
  it("a blocked main thread skips expired notes without catch-up burst", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    const ctx = Context.instances[0];
    a.setPlaying(true);
    a.update(0);
    const before = a.diagnostics().musicStep;
    ctx.currentTime = 10;
    a.update(10);
    expect(a.diagnostics().musicStep - before).toBeGreaterThan(80);
    expect(a.diagnostics().queuedMusicSteps).toBeLessThanOrEqual(3);
    expect(a.diagnostics().activeVoices).toBeLessThanOrEqual(12);
    a.dispose();
  });
});
