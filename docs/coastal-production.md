# Stage 01 production increment — 2026-11-16

This increment replaces the web-side mission card with in-game menus and integrates five original generated production assets. The scene remains 360×640 logical pixels. The harbor is a non-seamless image with bounded travel; surface wakes/clouds provide separate scrolling. It is not an endless tilemap. Hull banking, exhaust, pulses and particle-like impacts are runtime animation, not sprite-sheet animation.

## Play

WASD/arrows move; Space/Z fire; C changes between spread and concentrated beam projectiles; Shift slows movement and shows the player hitbox; X uses a limited bomb; P pauses. Beam is a rapid projectile weapon, not a continuous laser. Both modes share collected power level. No touchscreen controls are claimed.

The first stage now has a 115-second limit. The boss arrives at 70 seconds, giving 45 seconds to defeat it. Scouts sweep or descend, aimed gunships lock their aim during a warning, and heavy aircraft hold position and fire three lanes. The boss has three phases. No Stage 02 was added. The new duration supersedes the earlier 75-second prototype requirement after the user requested a fuller first-stage experience.

## Audio and persistence

Original Web Audio synthesis has separate beam/spread sounds, bounded voices, warning priority and cruise/heavy/boss rhythm intensity. Music and SFX sliders plus mute remain. No third-party audio was added. Storage key `p01-flight:save:v1` and schema are unchanged. Same-origin updates must preserve existing scores/settings; browser privacy/storage blocking can prevent saves.

## Evidence and limits

Local typecheck, 47 unit tests and production build passed during integration. Model-level actual input strategies passed at 30/60/120 FPS; this does not establish human gameplay feel. Final browser CI and screenshots are recorded in the PR after execution. Local browser launch is constrained by the cloud environment; no claim of local manual play or human audio audition is made. Private Sites deployment is coordinated separately and is not implied by a PR.

Original asset provenance, dimensions and hashes: [original-art-production.md](original-art-production.md). Existing Kenney projectile/exhaust attribution remains [asset-manifest.md](asset-manifest.md).
