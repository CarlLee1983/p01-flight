import {
  chooseAction,
  type PilotSnapshot,
  type Steering,
} from "./keyboard-policy";
/** Test driver only: sustained focused movement far away; brake before the
 * observation + key-up transport can cross the goal. Near-goal pulses never
 * span an extra observation RPC. Safety still comes from visible trajectories. */
export function goalControl(
  s: PilotSnapshot,
  held: Steering,
  goal: number,
  tolerance = 12,
  releaseLag = 0.2,
) {
  const near = Math.abs(s.player.x - goal) <= tolerance + 100 * releaseLag;
  const next = chooseAction({ ...s, focus: true }, held, goal);
  const toward = Math.sign(goal - s.player.x);
  if (near && held === toward && held !== 0)
    return { next: 0 as Steering, pulse: false };
  return { next, pulse: near };
}
