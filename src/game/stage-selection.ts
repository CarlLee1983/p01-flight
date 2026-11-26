import type { Save } from "../storage/save";
export const STAGE_ORDER = [
  "stage-01",
  "stage-02",
  "stage-03",
  "stage-04",
  "stage-05",
] as const;
export type StageId = (typeof STAGE_ORDER)[number];
export function stageUnlocked(id: StageId, save: Save): boolean {
  const i = STAGE_ORDER.indexOf(id);
  return (
    i === 0 || (i > 0 && save.stages[STAGE_ORDER[i - 1]]?.cleared === true)
  );
}
export function nextStage(id: StageId): StageId | null {
  const i = STAGE_ORDER.indexOf(id);
  return i < 0 ? null : (STAGE_ORDER[i + 1] ?? null);
}
export function newStageSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0];
}
