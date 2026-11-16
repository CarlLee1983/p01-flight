/** Original score: "Cloudline / First Sortie". MIDI pitches, no sampled music. */
export type MusicSection =
  | "intro"
  | "theme-a"
  | "theme-b"
  | "assault"
  | "breather"
  | "boss";
export type MusicPart = "lead" | "harmony" | "bass" | "kick" | "snare" | "hat";
export interface MusicNote {
  part: MusicPart;
  midi: number;
  steps: number;
  level: number;
}
export const MUSIC_STEP = 60 / 132 / 4; // 132 BPM, 4/4, sixteenth-note grid
export const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
// Eight distinct bars form a call, answer, development and cadence. 0 = rest.
const theme = [
  [76, 0, 0, 0, 79, 0, 81, 0, 83, 0, 0, 0, 79, 0, 76, 0],
  [74, 0, 0, 0, 76, 0, 79, 0, 81, 0, 0, 0, 79, 0, 0, 0],
  [72, 0, 0, 0, 76, 0, 79, 0, 83, 0, 81, 0, 79, 0, 76, 0],
  [74, 0, 0, 0, 78, 0, 81, 0, 83, 0, 0, 0, 81, 0, 78, 0],
  [76, 0, 79, 0, 83, 0, 0, 0, 86, 0, 83, 0, 81, 0, 79, 0],
  [81, 0, 0, 0, 79, 0, 76, 0, 74, 0, 0, 0, 76, 0, 79, 0],
  [79, 0, 81, 0, 83, 0, 86, 0, 88, 0, 0, 0, 86, 0, 83, 0],
  [78, 0, 0, 0, 74, 0, 78, 0, 83, 0, 0, 0, 0, 0, 0, 0],
];
const boss = [
  [76, 0, 76, 79, 83, 0, 81, 0, 79, 0, 76, 0, 74, 0, 78, 0],
  [78, 0, 81, 0, 84, 0, 83, 0, 81, 0, 78, 0, 75, 0, 0, 0],
  [79, 0, 83, 0, 86, 0, 83, 0, 81, 0, 79, 0, 76, 0, 74, 0],
  [75, 0, 78, 0, 83, 0, 0, 0, 87, 0, 83, 0, 78, 0, 75, 0],
];
const harmony = [
  [52, 55, 59],
  [50, 54, 57],
  [48, 52, 55],
  [47, 51, 54],
];
const bossHarmony = [
  [52, 55, 59],
  [54, 57, 60],
  [48, 52, 55],
  [47, 51, 54],
];
export function sectionFor(bar: number, intensity: 0 | 1 | 2): MusicSection {
  if (intensity === 2) return "boss";
  if (bar < 4) return "intro";
  if (intensity === 1) return "assault";
  const phrase = (bar - 4) % 24;
  return phrase < 8
    ? "theme-a"
    : phrase < 16
      ? "theme-b"
      : phrase < 20
        ? "assault"
        : "breather";
}
export function scoreStep(
  section: MusicSection,
  bar: number,
  step: number,
): MusicNote[] {
  const notes: MusicNote[] = [];
  const chord = (section === "boss" ? bossHarmony : harmony)[bar % 4];
  const dense = section === "boss" || section === "assault";
  const soft = section === "intro" || section === "breather";
  // Chords have time to ring. Space is intentional, rather than an endless arp.
  if (step === 0)
    for (const midi of chord)
      notes.push({
        part: "harmony",
        midi: midi + 12,
        steps: soft ? 12 : 7,
        level: soft ? 0.07 : 0.065,
      });
  if (step % (soft ? 8 : 4) === 0)
    notes.push({
      part: "bass",
      midi: chord[0] - 12 + (step === 12 ? 12 : 0),
      steps: soft ? 6 : 3,
      level: 0.23,
    });
  if (step === 0 || step === 8 || (dense && step === 11))
    notes.push({ part: "kick", midi: 35, steps: 1, level: 0.3 });
  if (!soft && (step === 4 || step === 12))
    notes.push({ part: "snare", midi: 50, steps: 1, level: 0.075 });
  if (!soft && (dense ? step % 2 === 0 : step % 4 === 2))
    notes.push({ part: "hat", midi: 105, steps: 0.25, level: 0.025 });
  const row = section === "boss" ? boss[bar % 4] : theme[bar % 8];
  let pitch = row[step];
  if (soft && step % 4 !== 0) pitch = 0;
  if (pitch) {
    let next = step + 1;
    while (next < 16 && !row[next]) next++;
    const transpose =
      section === "theme-b" && bar % 2 === 0 ? 12 : soft ? -12 : 0;
    notes.push({
      part: "lead",
      midi: pitch + transpose,
      steps: Math.max(1, next - step - 0.25),
      level: soft ? 0.15 : 0.22,
    });
  }
  return notes;
}
