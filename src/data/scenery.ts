export type CoastalScenery =
  | "offshore"
  | "channel"
  | "harbor"
  | "arena"
  | "exit"
  | "approach"
  | "command";
export interface CoastalAreaConfig {
  readonly id: string;
  readonly label: string;
  readonly at: number;
  readonly fade: number;
  readonly scenery: CoastalScenery;
}

export interface SceneryArtworkBlock {
  readonly id: string;
  readonly texture: string;
  /** Bottom edge enters viewport top at this simulation time. */
  readonly enterAt: number;
}
export interface SceneryTimeline {
  readonly artworkBlocks?: readonly SceneryArtworkBlock[];
  readonly exitAt: number;
  readonly duration: number;
  readonly areas: readonly CoastalAreaConfig[];
}

/** Stage 01 scenery follows combat beats but never resets world distance. */
export const STAGE01_SCENERY: SceneryTimeline = {
  artworkBlocks: [
    { id: "industrial-port", texture: "harbor-refinery", enterAt: 60 },
  ],
  exitAt: 108,
  duration: 170,
  areas: [
    { id: "offshore", label: "外海試探", at: 0, fade: 0, scenery: "offshore" },
    { id: "channel", label: "狹港入口", at: 15, fade: 4, scenery: "channel" },
    { id: "harbor", label: "港區火力", at: 32, fade: 5, scenery: "harbor" },
    { id: "elite-basin", label: "港池攔截", at: 40, fade: 3, scenery: "arena" },
    {
      id: "port-breakthrough",
      label: "突破港區",
      at: 50,
      fade: 3,
      scenery: "harbor",
    },
    {
      id: "supply-lane",
      label: "補給航道",
      at: 56,
      fade: 4,
      scenery: "approach",
    },
    {
      id: "port-suppression",
      label: "港區壓制",
      at: 62,
      fade: 4,
      scenery: "harbor",
    },
    {
      id: "escort-intercept",
      label: "護航航道",
      at: 78,
      fade: 4,
      scenery: "arena",
    },
    { id: "repair", label: "補給轉向", at: 96, fade: 3, scenery: "approach" },
    { id: "harbor-exit", label: "出口突圍", at: 102, fade: 4, scenery: "exit" },
    {
      id: "approach",
      label: "整隊接近",
      at: 121,
      fade: 3,
      scenery: "approach",
    },
    { id: "command", label: "指揮艦區", at: 125, fade: 5, scenery: "command" },
  ],
};
