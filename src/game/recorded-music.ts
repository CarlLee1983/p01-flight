/** Short edge taper prevents a discontinuity click; not a claim of a musical seamless loop. */
export function taperLoopEdge(samples: Float32Array, sampleRate: number): void {
  const frames = Math.min(
    Math.floor(sampleRate * 0.005),
    Math.floor(samples.length / 2),
  );
  if (frames < 2) return;
  for (let i = 0; i < frames; i++) {
    const gain = i / (frames - 1);
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
}
export type RecordedTrack = "stage01" | "boss";
type Voice = {
  track: RecordedTrack;
  source: AudioBufferSourceNode;
  gain: GainNode;
  offset: number;
  started: number;
};
export type RecordedMusicOptions = {
  /** Relative to Vite's BASE_URL; pass resolved paths when hosted under a subpath. */
  urls?: Record<RecordedTrack, readonly string[]>;
  fetch?: typeof fetch;
  visibility?: Pick<
    Document,
    "hidden" | "addEventListener" | "removeEventListener"
  >;
};

/** Owns only its sources and gain nodes, never closes the shared context.
 * No animation-frame/timer clock. unlockFromGesture must be called from user input.
 * Hidden pauses and invalidates pending playback; becoming visible does NOT resume.
 */
export class RecordedMusic {
  private readonly bus: GainNode;
  private readonly cache = new Map<
    RecordedTrack,
    Promise<AudioBuffer | null>
  >();
  private readonly buffers = new Map<RecordedTrack, AudioBuffer>();
  private readonly failedTracks = new Set<RecordedTrack>();
  private readonly voices = new Set<Voice>();
  private readonly abort = new AbortController();
  private readonly urls: Record<RecordedTrack, readonly string[]>;
  private readonly fetcher: typeof fetch;
  private readonly visibility?: RecordedMusicOptions["visibility"];
  private current: Voice | null = null;
  private track: RecordedTrack = "stage01";
  private offset = 0;
  private playing = false;
  private unlocked = false;
  private disposed = false;
  private epoch = 0;
  private volume = 0.6;
  private muted = false;
  private readonly onVisibility = () => {
    if (this.visibility?.hidden) this.pause();
  };
  constructor(
    private readonly context: AudioContext,
    output: AudioNode,
    options: RecordedMusicOptions = {},
  ) {
    this.urls = options.urls ?? {
      stage01: ["audio/stage01.ogg", "audio/stage01.mp3"],
      boss: ["audio/boss.ogg", "audio/boss.mp3"],
    };
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.visibility =
      options.visibility ??
      (typeof document === "undefined" ? undefined : document);
    this.bus = context.createGain();
    this.bus.connect(output);
    this.setVolume(this.volume);
    this.visibility?.addEventListener("visibilitychange", this.onVisibility);
  }
  /** Safe before unlock: fetch/decode only, never starts audio. Failed tracks cache null. */
  preload(track: RecordedTrack): Promise<AudioBuffer | null> {
    if (this.disposed) return Promise.resolve(null);
    const cached = this.cache.get(track);
    if (cached) return cached;
    const promise = this.load(track);
    this.cache.set(track, promise);
    return promise;
  }
  private async load(track: RecordedTrack): Promise<AudioBuffer | null> {
    for (const url of this.urls[track]) {
      if (this.disposed) return null;
      try {
        const response = await this.fetcher(url, { signal: this.abort.signal });
        if (!response.ok) continue;
        const bytes = await response.arrayBuffer();
        if (this.disposed) return null;
        const buffer = await this.context.decodeAudioData(bytes);
        if (this.disposed) return null;
        if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) continue;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++)
          taperLoopEdge(buffer.getChannelData(channel), buffer.sampleRate);
        this.buffers.set(track, buffer);
        return buffer;
      } catch {
        /* HTTP, unsupported codec and decode failure try next format. */
      }
    }
    if (!this.disposed) this.failedTracks.add(track);
    return null;
  }
  /** Call only from an explicit user gesture, not a fetch callback or update loop. */
  async unlockFromGesture(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      if (this.context.state === "suspended") await this.context.resume();
      if (this.disposed) return false;
      this.unlocked = this.context.state === "running";
      if (this.unlocked && this.playing && !this.visibility?.hidden)
        void this.start();
      return this.unlocked;
    } catch {
      return false;
    }
  }
  /** A track switch restarts the new track; same-track repeated calls are idempotent. */
  play(track: RecordedTrack = this.track): void {
    if (this.disposed || this.visibility?.hidden) return;
    if (this.playing && this.track === track) return;
    if (this.track !== track) this.offset = 0;
    this.track = track;
    this.playing = true;
    void this.start();
  }
  private async start(): Promise<void> {
    const epoch = ++this.epoch,
      track = this.track;
    if (
      !this.unlocked ||
      !this.playing ||
      this.disposed ||
      this.visibility?.hidden
    )
      return;
    const buffer = await this.preload(track);
    if (
      !buffer ||
      epoch !== this.epoch ||
      this.disposed ||
      !this.playing ||
      this.visibility?.hidden ||
      this.context.state !== "running"
    )
      return;
    if (this.current?.track === track) return;
    // At most old + new during a 250ms crossfade; repeated switches retire old tails.
    for (const voice of this.voices)
      if (voice !== this.current) this.retire(voice);
    const old = this.current;
    let voice: Voice | null = null;
    try {
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      voice = {
        track,
        source,
        gain,
        offset: this.offset % buffer.duration,
        started: this.context.currentTime,
      };
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(this.bus);
      this.voices.add(voice);
      const created = voice;
      source.onended = () => this.retire(created);
      gain.gain.setValueAtTime(old ? 0 : 1, this.context.currentTime);
      if (old)
        gain.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.25);
      source.start(0, voice.offset);
      this.current = voice;
      if (old) {
        old.gain.gain.cancelScheduledValues(this.context.currentTime);
        old.gain.gain.setValueAtTime(
          old.gain.gain.value,
          this.context.currentTime,
        );
        old.gain.gain.linearRampToValueAtTime(
          0,
          this.context.currentTime + 0.25,
        );
        old.source.stop(this.context.currentTime + 0.25);
      }
    } catch {
      if (voice) this.retire(voice);
      this.current = old;
    }
  }
  pause(): void {
    if (this.disposed) return;
    this.playing = false;
    ++this.epoch;
    if (this.current?.track === this.track) {
      const duration = this.buffers.get(this.track)?.duration ?? 1;
      this.offset =
        (this.current.offset +
          this.context.currentTime -
          this.current.started) %
        duration;
    }
    for (const voice of this.voices) this.retire(voice);
    this.current = null;
  }
  /** New game: clears saved offset and any old fade; still requires gesture unlock. */
  restart(track: RecordedTrack = "stage01"): void {
    this.pause();
    this.offset = 0;
    this.track = track;
    this.play(track);
  }
  setVolume(value: number): void {
    this.volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    if (!this.disposed) this.bus.gain.value = this.muted ? 0 : this.volume;
  }
  setMuted(value: boolean): void {
    this.muted = value;
    this.setVolume(this.volume);
  }
  private retire(voice: Voice): void {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    try {
      voice.source.stop();
    } catch {
      /* Already ended. */
    }
    voice.source.disconnect();
    voice.gain.disconnect();
    if (this.current === voice) this.current = null;
  }
  /** playing is requested playback; activeSources reports actual live/fading nodes.
   * loadFailed is true only after every format for the selected track failed.
   */
  diagnostics() {
    const durationSeconds = this.buffers.get(this.track)?.duration ?? 0;
    const voice = this.current?.track === this.track ? this.current : null;
    const elapsed = voice
      ? voice.offset + Math.max(0, this.context.currentTime - voice.started)
      : this.offset;
    return {
      track: this.track,
      activeTrack: this.current?.track ?? null,
      playing: this.playing,
      activeSources: this.voices.size,
      positionSeconds: durationSeconds > 0 ? elapsed % durationSeconds : 0,
      durationSeconds,
      loadedTracks: [...this.buffers.keys()],
      loadFailed: this.failedTracks.has(this.track),
      unlocked: this.unlocked,
    };
  }
  dispose(): void {
    if (this.disposed) return;
    this.pause();
    this.disposed = true;
    this.unlocked = false;
    this.abort.abort();
    this.cache.clear();
    this.buffers.clear();
    this.failedTracks.clear();
    this.bus.disconnect();
    this.visibility?.removeEventListener("visibilitychange", this.onVisibility);
  }
}
