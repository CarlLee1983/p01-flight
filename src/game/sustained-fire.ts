import type { Boss, Enemy } from "./model";
export interface SustainedRay {
  x: number;
  y: number;
  width: number;
  slope: number;
  kind: "lance" | "lattice";
  state: "charge" | "live";
  progress: number;
}
export const MINI_BEAM = { period: 5.2, charge: 1.05, fire: 2.25, end: 3.75 };
export const BEAM_PROFILES = {
  ascentGate: { entry: 2.4, period: 8, charge: 1.5, fire: 2.8, end: 5.2 },
  orbitalLattice: { entry: 2.9, period: 9, charge: 2, fire: 3.4, end: 5.8 },
} as const;

export function sustainedRays(
  boss: Boss | null,
  enemies: Enemy[],
): SustainedRay[] {
  const rays: SustainedRay[] = [];
  for (const e of enemies) {
    if (!e.active || !e.sustain || e.beamAge === undefined) continue;
    const t = e.beamAge % MINI_BEAM.period;
    if (t < MINI_BEAM.charge || t >= MINI_BEAM.end) continue;
    const live = t >= MINI_BEAM.fire;
    rays.push({
      x: e.x,
      y: e.y + 32,
      width: 8,
      slope: 0,
      kind: "lance",
      state: live ? "live" : "charge",
      progress: live ? (t - 2.25) / 1.5 : (t - 1.05) / 1.2,
    });
  }
  if (
    !boss?.active ||
    !boss.motion?.entered ||
    !boss.skin ||
    (boss.phaseAge ?? 0) < 1.3
  )
    return rays;
  const skin = boss.skin;
  if (skin !== "ascentGate" && skin !== "orbitalLattice") return rays;
  const v = BEAM_PROFILES[skin],
    age = boss.age - v.entry,
    t = age % v.period,
    cycle = Math.floor(age / v.period);
  if (t < v.charge || t >= v.end || (boss.phaseAge ?? 0) < t - v.charge)
    return rays;
  const live = t >= v.fire,
    progress = live
      ? (t - v.fire) / (v.end - v.fire)
      : (t - v.charge) / (v.fire - v.charge);
  const state = live ? "live" : "charge";
  if (skin === "ascentGate") {
    rays.push({
      x: boss.x,
      y: boss.y + 31,
      width: boss.phase === 3 ? 13 : 10,
      slope: (cycle % 2 ? 1 : -1) * (0.19 - (live ? progress * 0.38 : 0)),
      kind: "lance",
      state,
      progress,
    });
  } else {
    for (const side of [-1, 1])
      rays.push({
        x: boss.x + side * 52,
        y: boss.y + 40,
        width: boss.phase === 3 ? 14 : 10,
        slope: cycle % 2 && boss.phase >= 2 ? side * 0.13 : 0,
        kind: "lattice",
        state,
        progress,
      });
  }
  return rays;
}
export function sustainedX(ray: SustainedRay, y: number) {
  return ray.x + (y - ray.y) * ray.slope;
}
export function sustainedHit(ray: SustainedRay, x: number, y: number) {
  return (
    ray.state === "live" &&
    y >= ray.y &&
    y <= 640 &&
    Math.abs(x - sustainedX(ray, y)) <= ray.width
  );
}
