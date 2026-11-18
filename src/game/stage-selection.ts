import type { Save } from "../storage/save";
export type StageId = "stage-01" | "stage-02" | "stage-03";
export function stageUnlocked(id: StageId, save: Save): boolean {
  return id === "stage-01" || save.stages[id === "stage-02" ? "stage-01" : "stage-02"]?.cleared === true;
}
export function nextStage(id: StageId): StageId | null {
  return id === "stage-01" ? "stage-02" : id === "stage-02" ? "stage-03" : null;
}
export function newStageSeed(): number {
  const value = new Uint32Array(1);crypto.getRandomValues(value);return value[0];
}
