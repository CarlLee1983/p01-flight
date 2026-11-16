import type { FlightModel } from "./model";

export const MAX_FRAME_SECONDS = 0.25;
export const SIMULATION_STEP = 1 / 60;
/** Catch up ordinary slow rendering without tunnelling through collision checks.
 * A tab stall longer than 250ms is bounded; blur/visibility already pauses play.
 */
export function advanceFrame(
  model: FlightModel,
  seconds: number,
  dx: number,
  dy: number,
  fire: boolean,
  focus: boolean,
  target?: { x: number; y: number },
): number {
  let remaining = Number.isFinite(seconds)
    ? Math.min(MAX_FRAME_SECONDS, Math.max(0, seconds))
    : 0;
  let steps = 0;
  while (remaining > 1e-8) {
    const step = Math.min(SIMULATION_STEP, remaining);
    model.update(step, dx, dy, fire, focus, target);
    remaining -= step;
    steps++;
  }
  return steps;
}
