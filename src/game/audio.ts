export type FlightSound =
  | "shot"
  | "hit"
  | "explode"
  | "hurt"
  | "power"
  | "bomb"
  | "phase"
  | "won"
  | "lost";
type Voice = { oscillator: OscillatorNode; gain: GainNode; music: boolean };

/** Original procedural sounds and a small original pulse pattern. No audio files.
 * Call unlock only from a user gesture; construction and update never create audio.
 */
export class FlightAudio {
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private voices = new Set<Voice>();
  private volumes = { music: 0.6, sfx: 0.8 };
  private playing = false;
  private beat = 0;
  private untilBeat = 0;
  private lastSound = new Map<FlightSound, number>();
  private failed = false;
  private readonly visibility = () => {
    if (typeof document !== "undefined" && document.hidden)
      this.setPlaying(false);
  };
  constructor() {
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", this.visibility);
  }
  async unlock(): Promise<void> {
    try {
      if (!this.context) {
        const Constructor = globalThis.AudioContext;
        if (!Constructor) {
          this.failed = true;
          return;
        }
        this.context = new Constructor();
        this.musicBus = this.context.createGain();
        this.sfxBus = this.context.createGain();
        this.musicBus.connect(this.context.destination);
        this.sfxBus.connect(this.context.destination);
        this.setVolumes(this.volumes.music, this.volumes.sfx);
      }
      if (this.context.state === "suspended") await this.context.resume();
      this.failed = this.context.state !== "running";
    } catch {
      this.failed = true;
    }
  }
  setVolumes(music: number, sfx: number) {
    const clamp = (n: number) =>
      Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    this.volumes = { music: clamp(music), sfx: clamp(sfx) };
    // Bus gain also silences already sounding voices immediately.
    if (this.musicBus) this.musicBus.gain.value = this.volumes.music * 0.22;
    if (this.sfxBus) this.sfxBus.gain.value = this.volumes.sfx * 0.32;
  }
  setPlaying(value: boolean) {
    if (value && !this.playing) {
      this.beat = 0;
      this.untilBeat = 0;
    }
    this.playing = value;
    if (!value) this.stopVoices();
  }
  update(dt: number) {
    if (
      !this.playing ||
      !this.ready() ||
      (typeof document !== "undefined" && document.hidden)
    )
      return;
    this.untilBeat -= Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1);
    if (this.untilBeat > 0) return;
    this.untilBeat = 0.21; // no queued catch-up burst after an interrupted frame
    const bass = [82.41, 82.41, 98, 73.42][Math.floor(this.beat / 4) % 4];
    if (this.beat % 2 === 0)
      this.tone(bass, bass, 0.16, "triangle", 0.38, true);
    const ratio = [2, 3, 4, 3, 2, 4, 3, 2][this.beat % 8];
    this.tone(bass * ratio, bass * ratio, 0.08, "sine", 0.12, true);
    this.beat++;
  }
  play(kind: FlightSound) {
    if (
      !this.ready() ||
      this.volumes.sfx === 0 ||
      (typeof document !== "undefined" && document.hidden)
    )
      return;
    const now = this.context!.currentTime;
    const gap = kind === "shot" ? 0.085 : kind === "hit" ? 0.055 : 0.12;
    if (now - (this.lastSound.get(kind) ?? -Infinity) < gap) return;
    this.lastSound.set(kind, now);
    switch (kind) {
      case "shot":
        this.tone(1050, 320, 0.065, "triangle", 0.23);
        break;
      case "hit":
        this.tone(220, 90, 0.065, "square", 0.12);
        break;
      case "explode":
        this.tone(120, 28, 0.24, "sawtooth", 0.35);
        break;
      case "hurt":
        this.tone(190, 46, 0.32, "square", 0.3);
        break;
      case "power":
        this.chord([440, 660, 880], 0.22, 0.18);
        break;
      case "bomb":
        this.tone(80, 22, 0.7, "sawtooth", 0.5);
        this.tone(880, 90, 0.45, "triangle", 0.22);
        break;
      case "phase":
        this.chord([164.81, 233.08, 329.63], 0.5, 0.18);
        break;
      case "won":
        this.chord([523.25, 659.25, 783.99], 0.8, 0.22);
        break;
      case "lost":
        this.chord([146.83, 174.61, 220], 0.8, 0.18);
        break;
    }
  }
  private chord(notes: number[], duration: number, level: number) {
    for (const note of notes)
      this.tone(note, note, duration, "triangle", level);
  }
  private ready() {
    return (
      this.context?.state === "running" && !!this.musicBus && !!this.sfxBus
    );
  }
  private tone(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    level: number,
    music = false,
  ) {
    if (
      !this.ready() ||
      this.voices.size >= 16 ||
      (music ? this.volumes.music : this.volumes.sfx) === 0
    )
      return;
    const ctx = this.context!;
    let voice: Voice | null = null;
    try {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      voice = { oscillator, gain, music };
      this.voices.add(voice);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        to,
        ctx.currentTime + duration,
      );
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(music ? this.musicBus! : this.sfxBus!);
      const complete = voice;
      oscillator.onended = () => this.release(complete);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration + 0.01);
    } catch {
      if (voice) this.release(voice);
      this.failed = true;
    }
  }
  private release(voice: Voice) {
    voice.oscillator.onended = null;
    try {
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    } catch {}
    this.voices.delete(voice);
  }
  private stopVoices() {
    for (const voice of [...this.voices]) {
      try {
        voice.oscillator.stop();
      } catch {}
      this.release(voice);
    }
  }
  diagnostics() {
    return {
      state: this.context?.state ?? "locked",
      playing: this.playing,
      activeVoices: this.voices.size,
      musicVolume: this.volumes.music,
      sfxVolume: this.volumes.sfx,
      unavailable: this.failed,
    };
  }
  dispose() {
    this.setPlaying(false);
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", this.visibility);
    void this.context?.close().catch(() => {});
    this.context = null;
    this.musicBus = this.sfxBus = null;
  }
}
