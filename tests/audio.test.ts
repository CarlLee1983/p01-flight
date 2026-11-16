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
  start = vi.fn();
  stop = vi.fn();
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
    expect(a.diagnostics().activeVoices).toBe(4);
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
  it("intensity changes the next rhythmic pulse without stopping current envelopes", async () => {
    vi.stubGlobal("AudioContext", Context);
    const a = new FlightAudio();
    await a.unlock();
    const ctx = Context.instances[0];
    a.setPlaying(true);
    a.update(0.01);
    expect(ctx.oscillators).toHaveLength(3);
    const stopCalls = ctx.oscillators.map((o) => o.stop.mock.calls.length);
    a.setIntensity(2);
    expect(a.diagnostics().intensity).toBe(2);
    expect(ctx.oscillators.map((o) => o.stop.mock.calls.length)).toEqual(
      stopCalls,
    );
    a.update(0.1);
    a.update(0.1);
    a.update(0.1);
    expect(ctx.oscillators).toHaveLength(5); // offbeat arp plus high tick
    a.setPlaying(false);
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
});
