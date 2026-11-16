import { MUSIC_STEP, scoreStep, type MusicSection } from "./music";
import { musicTone, scheduleTone } from "./music-synth";
/** Test/evidence entry point; never imported into the production game. */
export async function renderMusicPreview() {
  const sampleRate = 22050,
    barsPerSection = 4;
  const sections: MusicSection[] = [
    "intro",
    "theme-a",
    "theme-b",
    "assault",
    "breather",
    "boss",
  ];
  const sectionSeconds = barsPerSection * 16 * MUSIC_STEP;
  const duration = sections.length * sectionSeconds + 1.5;
  const ctx = new OfflineAudioContext(
    1,
    Math.ceil(duration * sampleRate),
    sampleRate,
  );
  const bus = ctx.createGain();
  bus.gain.value = 0.6 * 0.22;
  bus.connect(ctx.destination);
  let scheduled = 0,
    ended = 0;
  for (let i = 0; i < sections.length; i++)
    for (let bar = 0; bar < barsPerSection; bar++)
      for (let step = 0; step < 16; step++) {
        const when = (i * barsPerSection * 16 + bar * 16 + step) * MUSIC_STEP;
        for (const note of scoreStep(sections[i], bar, step)) {
          const voice = scheduleTone(ctx, bus, when, musicTone(note));
          scheduled++;
          voice.oscillator.onended = () => {
            voice.dispose();
            ended++;
          };
        }
      }
  const buffer = await ctx.startRendering(),
    pcm = buffer.getChannelData(0);
  const stats = sections.map((section, i) => {
    const from = Math.floor(i * sectionSeconds * sampleRate),
      to = Math.floor((i + 1) * sectionSeconds * sampleRate);
    let peak = 0,
      sum = 0,
      nonzero = 0;
    for (let j = from; j < to; j++) {
      const v = pcm[j];
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
      if (Math.abs(v) > 1e-6) nonzero++;
    }
    return {
      section,
      peak,
      rms: Math.sqrt(sum / (to - from)),
      nonzero,
      samples: to - from,
    };
  });
  const wav = new ArrayBuffer(44 + pcm.length * 2),
    view = new DataView(wav);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, wav.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++)
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767),
      true,
    );
  bus.disconnect();
  return { wav, stats, scheduled, ended, duration, sampleRate };
}
