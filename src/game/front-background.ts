import type Phaser from "phaser";
export const FRONT_MAPS = [
  "front-ascent-industry",
  "front-ascent-cloud",
  "front-orbit-limb",
  "front-orbit-wreck",
] as const;
export class FrontBackground {
  private tiles: Phaser.GameObjects.Image[][];
  constructor(scene: Phaser.Scene) {
    this.tiles = FRONT_MAPS.map((key) =>
      [0, 1].map(() =>
        scene.add
          .image(0, 0, key)
          .setOrigin(0)
          .setDisplaySize(360, 640)
          .setDepth(-4)
          .setVisible(false),
      ),
    );
  }
  update(stage: string, time: number) {
    const ascent = stage === "stage-04",
      orbit = stage === "stage-05";
    const fade = Math.min(
      1,
      Math.max(0, (time - (ascent ? 74 : 56)) / (ascent ? 18 : 23)),
    );
    for (const [i, pair] of this.tiles.entries()) {
      const top = i % 2 === 1,
        visible = (i < 2 ? ascent : orbit) && (top ? fade > 0 : fade < 1);
      const offset = (time * [35, 27, 10, 21][i]) % 640;
      for (const [j, tile] of pair.entries()) {
        tile.setVisible(visible);
        if (visible)
          tile
            .setY(offset - 640 * j)
            .setAlpha(top ? fade : 1)
            .setDepth(top ? -3 : -4);
      }
    }
  }
  diagnostics(stage: string) {
    return {
      theme: stage === "stage-05" ? "orbital" : "ascent",
      artReady: this.tiles.every((p) => p[0].texture.key !== "__MISSING"),
    };
  }
}
