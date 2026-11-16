# Stage 01 scrolling and combat depth

This increment responds to actual play feedback on deployed commit 44078d: bounded 40-pixel background travel was not convincing scrolling; the two weapons and enemy roles still felt limited.

## Changes

- Continuous 32 logical pixels/second terrain travel. Four reusable coast images have 180-source-pixel alpha fades and overlap above a permanent ocean. This is runtime blending of the existing non-seamless source, not a claim that it became a seamless texture. Water currents move at 60 px/s and side clouds at 85 px/s. Pause freezes game-time movement.
- C cycles spread → piercing beam → homing missiles. Spread covers lanes; beam penetrates 2/3/4 distinct enemies at power levels 1/2/3 and never damages the same spawn twice per shot; missiles launch slowly, turn at a limited rate, retain/reacquire targets and expire rather than teleporting to hits. All modes share permanent collected power.
- Side-entry three-craft crossing formations and staggered lock-and-dive attackers join existing descending scouts, weaving scouts, aimed gunships and fixed-fan heavies. These change positioning demands without merely increasing projectile count.
- Original low-frequency missile launch sound; existing volume/mute/voice limits remain.

## Verification

63 unit tests and typecheck passed locally. Continuous scroll math, coverage around wrap boundaries and time freezing are tested. Normal input routes for spread/beam/missile clear Stage01 at 30/60/120 FPS in model tests; no browser game state is injected. Real browser E2E adds a recorded video and 5 timed canvas screenshots, scroll-distance/paused checks and measured frame rate. Final precise CI results and visual inspection must be recorded before declaring the increment ready.

Storage key/schema remains v1. No new stages, accounts, backend, public deployment or repository privacy changes. No manual audio listening or player satisfaction is inferred from automated tests.
