import type Phaser from "phaser";
/** Original code-native platform geometry, created once and reused by all waves. */
export function createGroundTextures(scene: Phaser.Scene) {
  for (const type of ["groundBattery", "groundDepot"] as const) {
    if (scene.textures.exists(type)) continue;
    const texture = scene.textures.createCanvas(type, 96, 96);
    if (!texture) continue;
    const c = texture.getContext();
    c.fillStyle = "#153139";
    c.fillRect(6, 9, 84, 80);
    c.strokeStyle = "#74989a";
    c.lineWidth = 3;
    c.strokeRect(9, 12, 78, 74);
    c.fillStyle = "#475e60";
    c.fillRect(16, 18, 64, 60);
    c.strokeStyle = "#263e46";
    c.lineWidth = 2;
    for (let y = 23; y < 78; y += 12) {
      c.beginPath();
      c.moveTo(16, y);
      c.lineTo(80, y);
      c.stroke();
    }
    c.fillStyle = "#dbb37a";
    for (const x of [12, 77]) for (const y of [15, 73]) c.fillRect(x, y, 7, 7);
    if (type === "groundBattery") {
      c.fillStyle = "#243f48";
      c.beginPath();
      c.arc(48, 46, 23, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#eeab72";
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = "#c6b9a2";
      c.fillRect(35, 42, 8, 37);
      c.fillRect(53, 42, 8, 37);
      c.fillStyle = "#e29d60";
      c.fillRect(43, 32, 10, 10);
    } else {
      c.fillStyle = "#b7b29a";
      c.fillRect(23, 26, 50, 42);
      c.strokeStyle = "#68624d";
      c.strokeRect(23, 26, 50, 42);
      c.fillStyle = "#578d81";
      c.fillRect(43, 26, 10, 42);
      c.fillStyle = "#e2dfac";
      c.fillRect(34, 42, 28, 10);
    }
    texture.refresh();
  }
}
