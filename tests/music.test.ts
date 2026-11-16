import { describe, expect, it } from "vitest";
import {
  MUSIC_STEP,
  midiHz,
  scoreStep,
  sectionFor,
  type MusicSection,
} from "../src/game/music";
describe("Cloudline original score", () => {
  it("has melody, voiced harmony, bass and rhythm across developed phrases", () => {
    const sections: MusicSection[] = [
      "intro",
      "theme-a",
      "theme-b",
      "assault",
      "breather",
      "boss",
    ];
    for (const section of sections) {
      const notes = Array.from({ length: 128 }, (_, i) =>
        scoreStep(section, Math.floor(i / 16), i % 16),
      ).flat();
      expect(notes.some((n) => n.part === "harmony")).toBe(true);
      expect(notes.some((n) => n.part === "bass")).toBe(true);
      expect(notes.some((n) => n.part === "kick")).toBe(true);
      expect(
        new Set(notes.filter((n) => n.part === "lead").map((n) => n.midi)).size,
      ).toBeGreaterThan(5);
      for (const n of notes) {
        expect(n.steps).toBeGreaterThan(0);
        expect(midiHz(n.midi)).toBeGreaterThan(20);
        expect(n.level).toBeLessThanOrEqual(0.3);
      }
    }
    const theme = Array.from({ length: 128 }, (_, i) =>
      scoreStep("theme-a", Math.floor(i / 16), i % 16),
    );
    const boss = Array.from({ length: 128 }, (_, i) =>
      scoreStep("boss", Math.floor(i / 16), i % 16),
    );
    expect(theme).not.toEqual(boss);
    expect(theme.slice(0, 16)).not.toEqual(theme.slice(16, 32));
  });
  it("keeps explicit hi-hat patterns in themes and dense sections", () => {
    for (const section of [
      "intro",
      "theme-a",
      "theme-b",
      "assault",
      "breather",
      "boss",
    ] as MusicSection[]) {
      const steps = Array.from({ length: 16 }, (_, step) => step).filter(
        (step) =>
          scoreStep(section, 0, step).some((note) => note.part === "hat"),
      );
      expect(steps).toEqual(
        section === "intro" || section === "breather"
          ? []
          : section === "assault" || section === "boss"
            ? [0, 2, 4, 6, 8, 10, 12, 14]
            : [2, 6, 10, 14],
      );
    }
  });
  it("arranges the full stage and permits heavy/boss cues", () => {
    expect(sectionFor(0, 0)).toBe("intro");
    expect(sectionFor(4, 0)).toBe("theme-a");
    expect(sectionFor(12, 0)).toBe("theme-b");
    expect(sectionFor(20, 0)).toBe("assault");
    expect(sectionFor(24, 0)).toBe("breather");
    expect(sectionFor(8, 1)).toBe("assault");
    expect(sectionFor(31, 2)).toBe("boss");
    expect(MUSIC_STEP * 16).toBeCloseTo((60 / 132) * 4);
  });
});
