import type Phaser from "phaser";
/** Original programmatic landscape. One Graphics batch, no per-triangle splitting.
 * A continuous world strip contains river terraces, bridges, mine rail and a dam.
 * Terrain never blocks player movement; all collidable targets are model enemies.
 */
export class CanyonBackground {
  private graphic: Phaser.GameObjects.Graphics;
  private time = 0;
  constructor(scene: Phaser.Scene) {
    this.graphic = scene.add.graphics().setDepth(-8);
  }
  update(time: number, visible: boolean) {
    this.time = time;
    const g = this.graphic;
    g.setVisible(visible);
    if (!visible) return;
    g.clear();
    g.fillStyle(0x744b3a);
    g.fillRect(0, 0, 360, 640);
    const travel = time * 32;
    // Fixed world-space chunks; edges shared across strip boundaries.
    for (
      let row = Math.floor((travel - 640) / 80);
      row <= Math.ceil((travel + 80) / 80);
      row++
    ) {
      const y = travel - row * 80;
      const bend = Math.sin(row * 0.35) * 22;
      g.fillStyle(0xa56b48);
      g.fillRect(0, y, 65 + bend, 81);
      g.fillRect(295 + bend, y, 65 - bend, 81);
      g.fillStyle(0xc58a59);
      g.fillRect(0, y + 4, 43 + bend, 72);
      g.fillRect(319 + bend, y + 4, 41 - bend, 72);
      g.fillStyle(0x4a3b35);
      g.fillRect(65 + bend, y, 15, 81);
      g.fillRect(280 + bend, y, 15, 81);
      g.fillStyle(0x34575b);
      g.fillRect(80 + bend, y, 200, 81);
      g.fillStyle(0x3d6c6b);
      g.fillRect(105 + bend, y, 144, 81);
      g.fillStyle(0x5a8480, 0.55);
      g.fillRect(127 + bend, y + 12, 65, 2);
      g.fillRect(182 + bend, y + 50, 49, 2);
      // Two road shoulders support the real rotating batteries.
      g.fillStyle(0x77716a);
      g.fillRect(30, y, 40, 81);
      g.fillRect(290, y, 40, 81);
      g.fillStyle(0xbca987);
      g.fillRect(48, y + 10, 3, 18);
      g.fillRect(308, y + 48, 3, 18);
      const h = Math.abs(Math.imul(row, 16777619) ^ 1931) % 43;
      g.fillStyle(0x604737);
      g.fillEllipse(14, y + h, 18, 10);
      g.fillEllipse(347, y + 70 - h, 20, 12);
    }
    for (const [at, kind] of [
      [29, "bridge"],
      [58, "mine"],
      [123, "dam"],
    ] as const) {
      const y = travel - at * 32 + 100;
      if (y < -220 || y > 820) continue;
      if (kind === "bridge") {
        g.fillStyle(0x252f34);
        g.fillRect(0, y + 12, 360, 66);
        g.fillStyle(0x838b87);
        g.fillRect(0, y, 360, 60);
        g.fillStyle(0x545f60);
        for (let x = 0; x < 360; x += 30) g.fillRect(x, y, 4, 60);
        g.lineStyle(3, 0xd4bd86);
        g.lineBetween(0, y + 6, 360, y + 6);
        g.lineBetween(0, y + 54, 360, y + 54);
      } else if (kind === "mine") {
        for (const x of [6, 294]) {
          g.fillStyle(0x303e40);
          g.fillRect(x, y, 60, 116);
          g.fillStyle(0x9b7252);
          g.fillRect(x + 6, y + 8, 48, 45);
          g.fillStyle(0xc6a77e);
          g.fillTriangle(x, y + 8, x + 30, y - 12, x + 60, y + 8);
          g.lineStyle(2, 0x182f34);
          g.lineBetween(x + 10, y + 60, x + 10, y + 116);
          g.lineBetween(x + 46, y + 60, x + 46, y + 116);
          for (let i = 0; i < 5; i++)
            g.lineBetween(x + 8, y + 65 + i * 10, x + 48, y + 65 + i * 10);
        }
      } else {
        g.fillStyle(0x22373c);
        g.fillRect(0, y + 18, 360, 140);
        g.fillStyle(0x858b7d);
        g.fillRect(0, y, 360, 105);
        for (let x = 74; x < 290; x += 30) {
          g.fillStyle(0x3c5c61);
          g.fillRect(x, y + 28, 18, 76);
          g.fillStyle(0x6ca4a1);
          g.fillRect(x + 5, y + 62, 7, 80);
        }
        g.fillStyle(0xc7b58d);
        g.fillRect(0, y + 6, 360, 9);
      }
    }
  }
  diagnostics() {
    return {
      theme: "canyon",
      time: this.time,
      worldDistance: this.time * 32,
      landmarks: ["bridge", "mine", "dam"],
    };
  }
}
