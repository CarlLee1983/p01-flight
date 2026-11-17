/** Original immediate-mode arcade effects. No particles, timers or random state.
 * Render this graphics object BELOW hostile projectiles and the HUD. */
export interface ImpactGraphics {
  fillStyle(color: number, alpha?: number): unknown;
  fillEllipse(x: number, y: number, width: number, height: number): unknown;
  fillTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ): unknown;
  lineStyle(width: number, color: number, alpha?: number): unknown;
  lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
}
export type ImpactKind = "hit" | "destroy" | "boss";
export const IMPACT_DURATION = { hit: 0.25, destroy: 0.45, boss: 0.6 } as const;
export const IMPACT_MAX_PRIMITIVES = 28;
/** Stable per-event variation. Caller should reuse the same seed for its lifetime. */
function noise(seed: number, index: number): number {
  let n = (seed | 0) ^ Math.imul(index + 1, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function drawImpact(
  g: ImpactGraphics,
  x: number,
  y: number,
  age: number,
  kind: ImpactKind = "destroy",
  scale = 1,
  seed = 0,
  duration: number = IMPACT_DURATION[kind],
): number {
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    age >= duration ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(scale) ||
    scale <= 0
  )
    return 0;
  const t = age / duration,
    s = Math.min(scale, 3),
    fade = 1 - t;
  let draws = 0;
  if (kind === "hit") {
    // Directional splinters, not an expanding warning ring.
    for (let i = 0; i < 5; i++) {
      const a = noise(seed, i) * Math.PI * 2;
      const distance = (2 + 19 * t) * s,
        length = (3 + noise(seed, i + 7) * 5) * fade * s;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      g.lineStyle((i % 2 ? 1 : 1.8) * s, i % 2 ? 0xb7c8d0 : 0xffe6a5, fade);
      g.lineBetween(
        x + dx * distance,
        y + dy * distance,
        x + dx * (distance + length),
        y + dy * (distance + length),
      );
      draws++;
    }
    if (t < 0.35) {
      g.fillStyle(0xffffff, 1 - t / 0.35);
      const r = (4 - 6 * t) * s;
      g.fillTriangle(x - r, y, x + r, y, x, y - r * 1.6);
      g.fillTriangle(x - r, y, x + r, y, x, y + r);
      draws += 2;
    }
    return draws;
  }
  // Cooling soot is behind the hot core/debris, never a black opaque disc.
  if (t > 0.3)
    for (let i = 0; i < 4; i++) {
      const n = noise(seed, i + 20),
        a = i * 1.7 + n;
      const drift = (3 + 16 * t) * s,
        r = (4 + 10 * t) * (0.7 + n * 0.4) * s;
      g.fillStyle(
        i % 2 ? 0x46545d : 0x25333e,
        Math.sin(((t - 0.3) / 0.7) * Math.PI) * 0.38,
      );
      g.fillEllipse(
        x + Math.cos(a) * drift,
        y + Math.sin(a) * drift - 8 * t * s,
        r * 1.3,
        r,
      );
      draws++;
    }
  // Overlapping hot volumes, not radial spikes: shadowed rust rims, orange
  // mid-volume and a smaller off-centre cream core suggest rolling fire.
  if (t < 0.7) {
    const expansion = Math.sin((Math.min(t / 0.5, 1) * Math.PI) / 2);
    const alpha = Math.min(1, (0.7 - t) * 3);
    for (let i = 0; i < 5; i++) {
      const n = noise(seed, i),
        a = noise(seed, i + 9) * Math.PI * 2;
      const reach = i === 0 ? 0 : (4 + n * 10) * expansion * s;
      const px = x + Math.cos(a) * reach;
      const py = y + Math.sin(a) * reach - t * 7 * s;
      const w = (7 + 17 * expansion) * (0.7 + n * 0.55) * s;
      const h = w * (0.65 + noise(seed, i + 14) * 0.45);
      g.fillStyle(i % 2 ? 0x9d3527 : 0xc44424, alpha);
      g.fillEllipse(px, py + h * 0.08, w, h);
      g.fillStyle(i % 2 ? 0xff8c32 : 0xffb449, alpha);
      g.fillEllipse(px - w * 0.07, py - h * 0.08, w * 0.78, h * 0.74);
      g.fillStyle(0xffedac, alpha * (1 - t * 0.6));
      g.fillEllipse(px - w * 0.13, py - h * 0.17, w * 0.43, h * 0.39);
      draws += 3;
    }
    // Only two detached tongues; they never form a star-shaped blast outline.
    for (let i = 0; i < 2; i++) {
      const a = noise(seed, i + 60) * Math.PI * 2;
      const dx = Math.cos(a),
        dy = Math.sin(a);
      const reach = (9 + 20 * expansion) * s;
      const px = x + dx * reach,
        py = y + dy * reach;
      g.fillStyle(0xffb64f, alpha * 0.8);
      g.fillTriangle(
        px - dy * 2 * s,
        py + dx * 2 * s,
        px + dy * 2 * s,
        py - dx * 2 * s,
        px + dx * 7 * s,
        py + dy * 7 * s,
      );
      draws++;
    }
  }
  for (let i = 0; i < 7; i++) {
    const n = noise(seed, i + 40),
      a = (i * Math.PI * 2) / 7 + n * 0.65;
    const dx = Math.cos(a),
      dy = Math.sin(a),
      r = (5 + (22 + n * 21) * t) * s;
    const px = x + dx * r,
      py = y + dy * r + 9 * t * t * s,
      length = (3 + n * 6) * (1 - t * 0.6) * s;
    g.lineStyle((1 + n) * s, i % 2 ? 0xa8b6bc : 0xffc45e, fade);
    g.lineBetween(px - dx * length, py - dy * length, px, py);
    draws++;
  }
  if (t < 0.2) {
    const r = (9 - 24 * t) * s;
    g.fillStyle(0xffffee, 1 - t / 0.2);
    g.fillTriangle(x - r, y, x + r, y, x + s, y - r * 1.1);
    g.fillTriangle(x - r, y, x + r, y, x - s, y + r * 0.8);
    draws += 2;
  }
  return draws;
}
