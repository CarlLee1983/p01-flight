import { createStage04 } from "../data/stage04";
import { createStage05 } from "../data/stage05";
import { stage01 } from "../data/stage";
import { createStage02 } from "../data/stage02";
import { createStage03 } from "../data/stage03";
import type { StageId } from "./stage-selection";
export const STAGE_CATALOG = [
  {
    id: "stage-01",
    number: "01",
    title: "雲際航線",
    brief: "穿越沿岸防線，擊破重裝指揮艦。",
    boss: "指揮艦",
  },
  {
    id: "stage-02",
    number: "02",
    title: "赤岩峽谷",
    brief: "沿赤岩河谷越過鐵橋、礦區與水壩，擊破鐵閘守衛。",
    boss: "鐵閘守衛",
  },
  {
    id: "stage-03",
    number: "03",
    title: "極光前哨",
    brief: "穿越雪原鐵道與機場，摧毀極地雷達防線。",
    boss: "極地雷眼",
  },
  {
    id: "stage-04",
    number: "04",
    title: "雲頂發射場",
    brief: "從發射台飛入雲層，避開攔截艦的持續光束。",
    boss: "天門陣列",
  },
  {
    id: "stage-05",
    number: "05",
    title: "星門決戰",
    brief: "飛過近地軌道與殘骸航道，摧毀星門。",
    boss: "星門核心",
  },
] as const;
export function stageDetails(id: StageId) {
  return STAGE_CATALOG.find((stage) => stage.id === id)!;
}
export function stageConfig(id: StageId, seed: number) {
  return {
    "stage-01": () => stage01,
    "stage-02": createStage02,
    "stage-03": createStage03,
    "stage-04": createStage04,
    "stage-05": createStage05,
  }[id](seed);
}
