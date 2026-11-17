import type Phaser from "phaser";
export type CloudKind = "bank" | "wisp";
/** Muted aerial layers, deliberately below projectile contrast. Keep above scenery,
 * below enemies/ground targets; do not multiply many banks over the same lane. */
export const CLOUD_ART = {
  bank: {
    key: "cloud-bank",
    width: 256,
    height: 160,
    displayWidth: 224,
    displayHeight: 140,
    alpha: 0.26,
  },
  wisp: {
    key: "cloud-wisp",
    width: 192,
    height: 224,
    displayWidth: 144,
    displayHeight: 168,
    alpha: 0.22,
  },
} as const;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
function hash(x: number, y: number, seed: number) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = smooth(x - ix),
    fy = smooth(y - iy);
  const a = hash(ix, iy, seed),
    b = hash(ix + 1, iy, seed),
    c = hash(ix, iy + 1, seed),
    d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
/** Pure seeded pixel source: no Math.random, clocks, images, or canvas dependency. */
export function generateCloudPixels(kind: CloudKind): Uint8ClampedArray {
  const { width, height } = CLOUD_ART[kind];
  const pixels = new Uint8ClampedArray(width * height * 4);
  const seed = kind === "bank" ? 0x51a7c10d : 0x23b8f70a;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1),
        v = y / (height - 1);
      // Domain warping breaks a regular oval into connected, uneven cloud lobes.
      const warpX = (noise(u * 4, v * 4, seed + 1) - 0.5) * 0.08;
      const warpY = (noise(u * 4, v * 4, seed + 2) - 0.5) * 0.06;
      const nx = (u + warpX) * 5,
        ny = (v + warpY) * 5;
      const broad = noise(nx, ny, seed);
      const middle = noise(nx * 2.1, ny * 2.1, seed + 3);
      const fine = noise(nx * 5.2, ny * 5.2, seed + 4);
      const grain = noise(nx * 11, ny * 11, seed + 5);
      const body = broad * 0.43 + middle * 0.29 + fine * 0.21 + grain * 0.07;
      const dx = (u - 0.5) * 2,
        dy = (v - 0.5) * 2;
      const envelope = Math.exp(-(dx * dx * 1.4 + dy * dy * 1.5));
      const density = smooth((body + envelope * 0.34 - 0.51) / 0.36);
      // Separate channels erode small windows without drawing explicit circular holes.
      const gap = smooth(
        (noise(nx * 1.7 + 7, ny * 1.7 - 3, seed + 6) - 0.58) / 0.22,
      );
      const edge = smooth(Math.min(u, 1 - u, v, 1 - v) / 0.14);
      const alpha = density * (1 - gap * 0.85) * edge;
      // Broad light/shadow facets and fine cotton texture, never pure white bloom.
      const light = clamp(0.35 + middle * 0.42 + fine * 0.18 + (1 - v) * 0.08);
      const i = (y * width + x) * 4;
      pixels[i] = Math.round(169 + light * 52);
      pixels[i + 1] = Math.round(185 + light * 40);
      pixels[i + 2] = Math.round(191 + light * 37);
      pixels[i + 3] = Math.round(alpha * 168);
    }
  return pixels;
}
/** Create once; every scrolling bank should reuse these cached CanvasTextures. */
export function createCloudTextures(scene: Phaser.Scene): void {
  for (const kind of Object.keys(CLOUD_ART) as CloudKind[]) {
    const { key, width, height } = CLOUD_ART[kind];
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture) continue;
    const c = texture.getContext();
    const image = c.createImageData(width, height);
    image.data.set(generateCloudPixels(kind));
    c.putImageData(image, 0, 0);
    texture.refresh();
  }
}
