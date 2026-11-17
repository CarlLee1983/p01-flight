import type { Save } from "../storage/save";
export type StageId = "stage-01" | "stage-02";
export function stageUnlocked(id: StageId, save: Save): boolean {
  return id === "stage-01" || save.stages["stage-01"]?.cleared === true;
}
export function nextStage(id: StageId): StageId | null {
  return id === "stage-01" ? "stage-02" : null;
}
export function newStageSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0];
}
