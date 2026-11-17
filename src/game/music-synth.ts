import { MUSIC_STEP, midiHz, type MusicNote } from "./music";
export interface ToneSpec {
  from: number;
  to: number;
  duration: number;
  type: OscillatorType;
  level: number;
  attack?: number;
  sustain?: boolean;
}
export function musicTone(note: MusicNote): ToneSpec {
  const duration = note.steps * MUSIC_STEP;
  if (note.part === "kick")
    return { from: 110, to: 35, duration, type: "sine", level: note.level };
  if (note.part === "snare")
    return { from: 230, to: 90, duration, type: "sawtooth", level: note.level };
  if (note.part === "hat")
    return {
      from: 3800,
      to: 2200,
      duration,
      type: "square",
      level: note.level,
    };
  return {
    from: midiHz(note.midi),
    to: midiHz(note.midi),
    duration,
    type: note.part === "lead" ? "triangle" : "sine",
    level: note.level,
    attack: note.part === "harmony" ? 0.035 : 0.008,
    sustain: true,
  };
}
/** Shared by real-time playback and OfflineAudioContext evidence rendering. */
export function scheduleTone(
  ctx: BaseAudioContext,
  destination: AudioNode,
  when: number,
  spec: ToneSpec,
) {
  const oscillator = ctx.createOscillator(),
    gain = ctx.createGain();
  const attack = spec.attack ?? 0.006;
  oscillator.type = spec.type;
  oscillator.frequency.setValueAtTime(spec.from, when);
  oscillator.frequency.exponentialRampToValueAtTime(
    spec.to,
    when + spec.duration,
  );
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(spec.level, when + attack);
  if (spec.sustain)
    gain.gain.setValueAtTime(
      spec.level * 0.65,
      when + Math.max(attack, spec.duration * 0.72),
    );
  gain.gain.exponentialRampToValueAtTime(0.001, when + spec.duration);
  oscillator.connect(gain);
  gain.connect(destination);
  const dispose = () => {
    oscillator.onended = null;
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.onended = dispose;
  try {
    oscillator.start(when);
    oscillator.stop(when + spec.duration + 0.01);
  } catch (error) {
    dispose();
    throw error;
  }
  return { oscillator, gain, dispose };
}
