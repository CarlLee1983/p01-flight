# Touch test pilot: stopping-target trajectory checks

This is test infrastructure, not an in-game auto-pilot or a difficulty change.

The old test selected a direction by checking an extrapolated bullet endpoint,
then sent only a 16 px touch destination. That destination stops the player;
it does not reproduce a continuously held keyboard direction. It also did not
check collisions along the movement segment.

`chooseTouchTarget(snapshot, previousTarget)` returns an absolute logical x.
The caller must map that x to its current touch anchor and canvas coordinates.
Keep y unchanged, preserve the primary touch, and keep sampling until victory
(including after the second bomb). Only visible projectile positions/velocities
and the player's current position are read. No future schedule, health changes,
clock changes or synthetic damage are used by the policy.

Candidates: current position, previous target, and ±24/48/72 px. Each candidate
uses 240 px/s movement followed by a stationary segment after arrival, across a
0.35 s horizon. Analytic relative-motion closest approach evaluates both segments.
Boundaries clamp to the model's 18 px margin. A small previous-target preference
reduces unnecessary reversals; optional recentering requires a clear entire path.

## Verified locally

- Early target arrival followed by collision is detected, even if continuously
  moving on the same heading would clear the projectile.
- Unsafe recentering and both boundaries are covered.
- 14 full model routes at 10/12/15/20/30/60/120 FPS, each with fixed 100 ms and
  repeating 50/120/80/180/100 ms observation gaps, won using original health and
  original two bombs at 140/146 s. Routes include the 70 s shore counterattack
  and return to center; all observed 405 airborne entrants.
- These observation gaps hold the previous touch destination while the game
  advances, including its natural stop on arrival.

## Not yet verified by this report

Real CDP delivery latency, browser-render timing, coordinate mapping after
resize, actual mobile touch and the precise failing CI route require E2E reruns.
Model victory is not browser victory. An observation-gap test is not a measured
RPC latency distribution. Bounds and horizon are a finite test heuristic, not
an assurance that every arbitrary projectile state is survivable.

The pre-fix PR run 44030814043 lost at 89.9 s (25,750 points), before the Boss,
while same-head push run 44030807551 passed. This is evidence of timing-sensitive
pilot coverage, not evidence of a deterministic game defect or its unique cause.
The E2E caller now uses stopping-target evaluation and continues normal touch
steering after the second bomb; all existing health, count and persistence
assertions remain. Required final browser evidence is collected on the new head.
