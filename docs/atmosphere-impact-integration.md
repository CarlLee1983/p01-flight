# Atmosphere and impact presentation

This change does not alter health, damage, collision, projectile count, stage timing,
scoring, storage or bomb rules. It replaces three barely visible ellipse clouds
with six reused images made from two original seeded textures: high wisps at
42 logical px/s and low banks at85 px/s, with slow side drift. All remain beneath
ground units, aircraft and bullets. Alpha is deliberately limited, not additive.

Damage records a 55 ms body flash. Phaser 4's deprecated `setTintFill()` is a no-op;
use `setTint(color).setTintMode(Phaser.TintModes.FILL)` and reset every pooled image
to MULTIPLY before reuse. No positional recoil or gameplay hit-stop is introduced.

Hit, aircraft destruction and Boss destruction use deterministic staged effects.
Dedicated Graphics depth2.7 remains below hostile-projectile depth3 and HUD4.5.
Existing lifetimes (hit .25s, destruction .45s, Boss .6s, player .4s) are preserved.
Pickup installation keeps its existing module animation, no longer masquerading
as a destruction explosion. Effect variation derives only from a stable position
seed; there are no persistent emitter objects or per-frame random draws.

Local canvas/primitive previews are not proof of Phaser composition. Required
final evidence includes 320px battle screenshots, successive video frames, normal
keyboard/touch clear and persistence, and exact-head CI. CPU draw metrics are not
GPU or real-phone FPS, and automated survival is not a human enjoyment verdict.

Review follow-up: body identity is passed directly into sprite presentation; no
coordinate-based enemy-pool search remains. A WeakMap remembers the latest shown
hit token, so a hit arriving between slow renders is presented for at least one
frame even if its 55 ms simulation interval expired. It does not replay unchanged
hits or modify HP, collision or timing. Full-frame peak effect count and actual
impact primitive count are instrumented alongside CPU draw timings; the per-effect
limit is not treated as a whole-scene performance guarantee.
