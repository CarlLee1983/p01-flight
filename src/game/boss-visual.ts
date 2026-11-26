import { bossRig, type BossSkin } from "./boss-rigs";
export type { BossSkin } from "./boss-rigs";
/** Weapons remain reusable separate destructible components; cores have distinct silhouettes. */
export function bossVisual(skin: BossSkin = "command") {
  if (skin === "ascentGate" || skin === "orbitalLattice")
    return {
      key: bossRig(skin).key,
      name: skin === "ascentGate" ? "天門陣列" : "星門核心",
      bank: 0,
    };
  return skin === "riverFortress"
    ? { key: bossRig(skin).key, name: "鐵閘守衛", bank: 0 }
    : skin === "polarRadar"
      ? { key: bossRig(skin).key, name: "極地雷眼", bank: 0 }
      : { key: "boss", name: "指揮艦", bank: 1 };
}
