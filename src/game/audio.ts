import { RecordedMusic } from "./recorded-music";
import { musicTone, scheduleTone } from "./music-synth";
import { MUSIC_STEP, scoreStep, sectionFor, type MusicSection } from "./music";
export type FlightSound =
  | "missile"
  | "beam"
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

/** Original SFX with licensed recorded BGM by default. Legacy synth retained for archival tests.
 * Call unlock only from a user gesture; construction and update never create audio.
 */
export class FlightAudio {
  private recorded: RecordedMusic | null = null;
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private voices = new Set<Voice>();
  private volumes = { music: 0.6, sfx: 0.8 };
  private playing = false;
  private intensity: 0 | 1 | 2 = 0;
  private musicContext: "flight" | "pressure" | "recovery" | "boss" | null =
    null;
  private notesScheduled = 0;
  private sectionTransitionCount = 0;
  private warningUntil = 0;
  private beat = 0;
  private section: MusicSection = "intro";
  private sectionBar = 0;
  private nextStepAt: number | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private queuedSteps: {
    time: number;
    beat: number;
    section: MusicSection;
    bar: number;
  }[] = [];
  private lastSound = new Map<FlightSound, number>();
  private failed = false;
  private readonly visibility = () => {
    if (typeof document !== "undefined" && document.hidden)
      this.setPlaying(false);
  };
  constructor(private readonly useRecordedMusic = true) {
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
        if (this.useRecordedMusic) {
          const base = import.meta.env.BASE_URL;
          this.recorded = new RecordedMusic(this.context, this.musicBus, {
            urls: {
              stage01: [`${base}audio/stage01.ogg`, `${base}audio/stage01.mp3`],
              boss: [`${base}audio/boss.ogg`, `${base}audio/boss.mp3`],
            },
          });
          this.recorded.setVolume(1);
        }
      }
      if (this.context.state === "suspended") await this.context.resume();
      this.failed = this.context.state !== "running";
      if (this.recorded) {
        await this.recorded.unlockFromGesture();
        void this.recorded.preload("boss");
        if (this.playing)
          this.recorded.play(this.musicContext === "boss" ? "boss" : "stage01");
      }
    } catch {
      this.failed = true;
    }
  }
  setVolumes(music: number, sfx: number) {
    const clamp = (n: number) =>
      Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    this.volumes = { music: clamp(music), sfx: clamp(sfx) };
    // Bus gain also silences already sounding voices immediately.
    if (this.musicBus) {
      if (this.useRecordedMusic && this.context)
        this.musicBus.gain.cancelScheduledValues(this.context.currentTime);
      this.musicBus.gain.value = this.volumes.music * 0.22;
    }
    if (this.sfxBus) this.sfxBus.gain.value = this.volumes.sfx * 0.32;
  }
  setPlaying(value: boolean) {
    this.playing = value;
    if (this.useRecordedMusic) {
      if (value)
        this.recorded?.play(this.musicContext === "boss" ? "boss" : "stage01");
      else {
        this.recorded?.pause();
        this.stopVoices();
      }
      return;
    }
    if (value && !this.scheduler)
      this.scheduler = setInterval(() => this.scheduleMusic(), 25);
    if (!value) {
      if (this.scheduler) clearInterval(this.scheduler);
      this.scheduler = null;
      const future = this.queuedSteps.find(
        (s) => s.time > (this.context?.currentTime ?? 0),
      );
      if (future) {
        this.beat = future.beat;
        this.section = future.section;
        this.sectionBar = future.bar;
      }
      this.queuedSteps = [];
      this.nextStepAt = null;
      this.stopVoices();
    }
  }
  /** New run only. Pauses retain position; call before setPlaying(true). */
  resetMusic() {
    this.recorded?.restart("stage01");
    if (!this.playing) this.recorded?.pause();
    this.stopVoices();
    this.beat = 0;
    this.nextStepAt = null;
    this.queuedSteps = [];
    this.section = "intro";
    this.sectionBar = 0;
    this.intensity = 0;
    this.musicContext = null;
    this.notesScheduled = 0;
    this.sectionTransitionCount = 0;
    this.warningUntil = 0;
    this.lastSound.clear();
  }
  /** Section changes are quantized to the next bar; existing notes finish. */
  setIntensity(level: 0 | 1 | 2) {
    this.intensity = level === 2 ? 2 : level === 1 ? 1 : 0;
  }
  /** Explicit encounter context; takes precedence over legacy intensity. */
  setMusicContext(context: "flight" | "pressure" | "recovery" | "boss") {
    this.musicContext = context;
    if (this.useRecordedMusic && this.playing)
      this.recorded?.play(context === "boss" ? "boss" : "stage01");
  }
  update(_dt: number) {
    this.scheduleMusic();
  }
  private scheduleMusic() {
    if (this.useRecordedMusic) return;
    if (
      !this.playing ||
      !this.ready() ||
      (typeof document !== "undefined" && document.hidden)
    )
      return;
    const now = this.context!.currentTime;
    this.queuedSteps = this.queuedSteps.filter((s) => s.time > now);
    if (this.nextStepAt === null) this.nextStepAt = now + 0.01;
    // A stalled JS thread cannot play past notes. Skip rather than burst or
    // slow the musical clock; normal 25ms scheduling is independent of RAF.
    if (this.nextStepAt < now) {
      const missed = Math.ceil((now - this.nextStepAt) / MUSIC_STEP);
      this.beat += missed;
      this.nextStepAt += missed * MUSIC_STEP;
    }
    let scheduledSteps = 0;
    while (this.nextStepAt < now + 0.15 && scheduledSteps++ < 3) {
      this.queuedSteps.push({
        time: this.nextStepAt,
        beat: this.beat,
        section: this.section,
        bar: this.sectionBar,
      });
      this.scheduleStep(this.nextStepAt);
      this.nextStepAt += MUSIC_STEP;
    }
  }
  private scheduleStep(when: number) {
    const step = this.beat % 16;
    if (step === 0) {
      const bar = Math.floor(this.beat / 16);
      const next =
        this.musicContext === "boss"
          ? "boss"
          : this.musicContext === "recovery"
            ? "breather"
            : this.musicContext === "pressure"
              ? "assault"
              : sectionFor(
                  bar,
                  this.musicContext === "flight" ? 0 : this.intensity,
                );
      if (next !== this.section) {
        this.section = next;
        this.sectionBar = 0;
        this.sectionTransitionCount++;
      } else if (this.beat > 0) this.sectionBar++;
    }
    const duck = this.context!.currentTime < this.warningUntil ? 0.2 : 1;
    for (const note of scoreStep(this.section, this.sectionBar, step)) {
      const tone = musicTone(note);
      this.tone(
        tone.from,
        tone.to,
        tone.duration,
        tone.type,
        tone.level * duck,
        true,
        tone.attack,
        tone.sustain,
        when,
      );
    }
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
    const routine = ["shot", "beam", "missile", "hit", "explode"].includes(
      kind,
    );
    if (
      routine &&
      (now < this.warningUntil ||
        this.voices.size + (kind === "beam" ? 2 : 1) > 14)
    )
      return;
    const gap =
      kind === "missile"
        ? 0.22
        : kind === "beam"
          ? 0.16
          : kind === "shot"
            ? 0.085
            : kind === "hit"
              ? 0.055
              : 0.12;
    if (now - (this.lastSound.get(kind) ?? -Infinity) < gap) return;
    this.lastSound.set(kind, now);
    switch (kind) {
      case "missile":
        // Low rising launch thump, distinct from the chirp and sustained beam.
        this.tone(48, 140, 0.2, "triangle", 0.24, false, 0.012);
        break;
      case "beam":
        // Two stable, beating harmonics and a slower attack make this a buzz,
        // unlike the spread shot's short downward chirp. Both remain quiet.
        this.tone(176, 168, 0.18, "sawtooth", 0.075, false, 0.025);
        this.tone(352, 360, 0.18, "sine", 0.08, false, 0.025);
        break;
      case "shot":
        this.tone(1050, 320, 0.065, "triangle", 0.17);
        break;
      case "hit":
        this.tone(220, 90, 0.065, "square", 0.12);
        break;
      case "explode":
        this.tone(120, 28, 0.24, "sawtooth", 0.35);
        break;
      case "hurt":
        this.warningUntil = now + 0.4;
        if (this.useRecordedMusic && this.musicBus) {
          const gain = this.musicBus.gain;
          gain.cancelScheduledValues(now);
          gain.setValueAtTime(this.volumes.music * 0.22 * 0.3, now);
          gain.setValueAtTime(this.volumes.music * 0.22 * 0.3, now + 0.32);
          gain.linearRampToValueAtTime(this.volumes.music * 0.22, now + 0.5);
        }
        // Keep two slots free during ordinary fire so damage cannot disappear.
        this.tone(190, 46, 0.32, "square", 0.3);
        this.tone(740, 370, 0.16, "triangle", 0.15);
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
    attack = 0.006,
    sustain = false,
    when = this.context?.currentTime ?? 0,
  ) {
    if (
      !this.ready() ||
      this.voices.size >= (music ? 12 : 16) ||
      (music ? this.volumes.music : this.volumes.sfx) === 0
    )
      return;
    const ctx = this.context!;
    let voice: Voice | null = null;
    try {
      const { oscillator, gain } = scheduleTone(
        ctx,
        music ? this.musicBus! : this.sfxBus!,
        when,
        { from, to, duration, type, level, attack, sustain },
      );
      voice = { oscillator, gain, music };
      this.voices.add(voice);
      const complete = voice;
      oscillator.onended = () => this.release(complete);
      if (music) this.notesScheduled++;
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
      recorded: this.recorded?.diagnostics() ?? null,
      state: this.context?.state ?? "locked",
      playing: this.playing,
      intensity: this.intensity,
      musicContext: this.musicContext,
      musicSection: this.section,
      notesScheduled: this.notesScheduled,
      sectionTransitionCount: this.sectionTransitionCount,
      musicBar: Math.floor(this.beat / 16),
      musicStep: this.beat,
      queuedMusicSteps: this.queuedSteps.length,
      activeVoices: this.voices.size,
      musicVolume: this.volumes.music,
      sfxVolume: this.volumes.sfx,
      unavailable:
        this.failed || (this.recorded?.diagnostics().loadFailed ?? false),
    };
  }
  dispose() {
    this.setPlaying(false);
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", this.visibility);
    this.recorded?.dispose();
    this.recorded = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.musicBus = this.sfxBus = null;
  }
}
