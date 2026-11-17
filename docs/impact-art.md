# Original arcade impact presentation

`drawImpact(graphics, x, y, age, kind, scale, seed, duration)` is immediate-mode
original geometry. It draws no warning rings, creates no particle objects,
changes no gameplay state and uses no random generator or persistent timers.

- `age` is elapsed seconds, not remaining life. Use `duration - life`.
- Kind `hit` defaults to 0.25 s, `destroy` to 0.45 s, `boss` to 0.6 s.
  A final explicit duration preserves the existing 0.4 s player damage effect.
- A seed must remain fixed throughout each event. Coordinates hashed once or
  a stable event identifier work. Scale is capped at 3.
- Invalid ages, nonfinite geometry, and expired effects draw nothing.

Hits show a white ignition fragment and five directional hot/metallic splinters.
Destruction starts with an irregular white core, then five asymmetric overlapping
volumetric fire lobes with shadowed red rims, orange bodies, cream highlights
and only two detached flame tongues and seven stretched debris tracks. Four
low-opacity drifting smoke lobes appear after 30% of the lifetime; flame tongues
end at 70%, leaving cooling soot and fragments. All trajectories derive from
age and seeded scalar arithmetic. Maximum draw primitives per event is bounded
by the exported 28-primitive budget; no persistent particle allocation is used.
The Phaser Graphics command buffer still performs its usual drawing work.

## Integration

Draw effects on a dedicated layer below hostile projectiles and below the HUD.
Do not draw these on the old high overlay layer: that would hide incoming fire.
Render damage highlights on the actual enemy briefly; this helper owns only the
impact itself. Pickup events must retain their pickup presentation, not explode.

`impact-contact-sheet.svg` is an original generated six-frame contact sheet for
hit, destroy and boss effects, directly adapted from this function's primitive
calls. It is a geometry/timing preview, not proof of in-game layering or feel.

## Checks

Unit tests verify deterministic seed variation, finite geometry and primitive
bounds across 121 samples for all kinds and the 0.4 s override, exact expiry,
and distinct ignition/flame/smoke phases. In-game animation, overlap under heavy
fire, performance, browser screenshots and final depth ordering require the
integrator's real-game checks. Local Playwright preview could not launch due to
missing managed Chromium and system Chromium sandbox/socket restrictions;
no restriction was bypassed. The initial contact sheet was rasterized from the
same SVG primitives for visual inspection, not captured from the game.
