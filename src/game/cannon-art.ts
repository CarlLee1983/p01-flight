import type Phaser from "phaser";
/** Original canvas geometry, created once like the existing pickup textures.
 * 32x48 display: centre (16,24), barrel terminates at (16,46), matching y+22. */
export function createCannonTextures(scene: Phaser.Scene) {
  for (const damaged of [false, true]) {
    const key = damaged ? "boss-cannon-broken" : "boss-cannon";
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, 64, 96);
    if (!texture) continue;
    const c = texture.getContext();
    c.scale(2, 2);
    const polygon = (points: number[][], color: string) => {
      c.fillStyle = color;
      c.beginPath();
      points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
    };
    // Undercarriage, clipped shoulder armor, shaded flank and red hull band.
    polygon(
      [
        [4, 9],
        [10, 4],
        [24, 4],
        [29, 10],
        [28, 32],
        [22, 38],
        [9, 36],
        [3, 28],
      ],
      "#101d27",
    );
    polygon(
      [
        [4, 8],
        [10, 3],
        [22, 3],
        [27, 8],
        [25, 29],
        [21, 34],
        [9, 32],
        [5, 26],
      ],
      damaged ? "#283039" : "#56646a",
    );
    polygon(
      [
        [4, 8],
        [10, 3],
        [22, 3],
        [25, 7],
        [10, 7],
        [7, 27],
        [5, 26],
      ],
      damaged ? "#52575a" : "#b09b80",
    );
    polygon(
      [
        [22, 8],
        [27, 8],
        [25, 29],
        [21, 34],
        [19, 28],
      ],
      "#27333d",
    );
    polygon(
      [
        [8, 10],
        [23, 10],
        [23, 15],
        [8, 15],
      ],
      damaged ? "#403139" : "#913f35",
    );
    c.fillStyle = "#1c2932";
    c.fillRect(9, 18, 14, 10);
    c.fillStyle = damaged ? "#3d4548" : "#728188";
    c.fillRect(11, 19, 10, 7);
    if (!damaged) {
      c.fillStyle = "#17232c";
      c.fillRect(11, 27, 10, 17);
      c.fillStyle = "#a7afb0";
      c.fillRect(13, 27, 3, 18);
      c.fillStyle = "#52626a";
      c.fillRect(16, 27, 3, 18);
      c.fillStyle = "#18232a";
      c.fillRect(12, 43, 8, 3);
      c.fillStyle = "#c2a479";
      c.fillRect(14, 45, 4, 1);
    } else {
      polygon(
        [
          [9, 24],
          [15, 20],
          [19, 25],
          [23, 23],
          [22, 32],
          [15, 35],
          [10, 31],
        ],
        "#0a151e",
      );
      polygon(
        [
          [10, 26],
          [13, 29],
          [12, 35],
          [8, 33],
        ],
        "#7b7e78",
      );
      polygon(
        [
          [22, 25],
          [24, 29],
          [20, 34],
          [19, 31],
        ],
        "#657078",
      );
      c.fillStyle = "#b35d38";
      c.fillRect(16, 27, 2, 3);
    }
    c.fillStyle = damaged ? "#666c69" : "#c2b49b";
    for (const [x, y] of [
      [8, 8],
      [23, 8],
      [7, 25],
      [23, 25],
    ])
      c.fillRect(x, y, 1, 1);
    texture.refresh();
  }
}
