# Stage 01 enemy presentation audit

Read-only code/asset audit, 2026-11-17. This records the working tree **before**
the concurrent escort/patrol/gunship art replacement; it does not claim those
repairs or final-browser acceptance. Sources: `src/main.ts` enemy/boss rendering,
`src/game/model.ts`, `src/data/stage.ts`, `enemy-patterns.ts`, `boss-muzzles.ts`,
`raider-geometry.ts`, `cannon-art.ts` and original PNGs. Scout, heavy, interceptor
and boss source pixels were inspected. Dimensions below are logical display
pixels, not source resolution. No gameplay or rendering code changed for this audit.

## Complete role inventory

All active aircraft have the shared damage-body flash hook (55 ms logical hit
window plus presentation retention), 0.25 s hit fragments, 0.45 s destruction
unless noted. The old additive attachment geometry does **not** share the body
flash: only the Image receiving `damageBody` flashes. All aircraft currently get
an unrotated generic ground shadow at x+12/y+22, usually 38×20. That shadow is a
lighting abstraction, not a hull silhouette; it follows translation but not bank.

| Role / Stage 01 count            | Asset and display                                                                  | Rotation / sockets / visible defect                                                                                                                                                                                                                            | Minimal correction and coverage                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| straight / 112                   | original scout.png 272×231 → 42×36                                                 | Down-facing; firing twin sockets derived by rotating ±9 along **bullet angle**, not hull. PNG has no two clearly matched sockets. Charge is center x/y+17.                                                                                                     | Fixed hull-relative twin socket helper shared with charge/emission; no new behavior. 2–5 s initial contact and 13–15 s armed flight.                                                                                                                                                                                                           |
| weave / 128                      | same scout 42×36, amber tint                                                       | Body banks ±18°, shadow stays flat; charge remains x/y+17 and firing sockets depend on bullet angle, neither follows bank. Visually a tinted scout, not a new hull.                                                                                            | Either stop cosmetic bank or transform sockets by actual body angle; preserve existing left/right attack angles separately. 17–20 s and 63–66 s.                                                                                                                                                                                               |
| cross / 125                      | original interceptor.png 252×376 → 28×42                                           | Body rotates ±72°, but charge remains beneath world center; firing sockets use ray angle rather than ±72° body. As a result flash/projectiles can emerge beside hull. No detached engine attachment.                                                           | Shared body transform for socket position only, retain locked ray velocity. Show both left/right entries 21–24 s and 99–103 s.                                                                                                                                                                                                                 |
| dive / 8                         | same interceptor 28×42                                                             | Body tracks locked diveAngle; generic center y+17 charge does not rotate. Current waves have no fireEvery: charge signals ram commitment, **not a firing muzzle**.                                                                                             | Treat cue as engine/whole-hull charge or rotate a non-gun charge point; do not add projectiles to fix visual mismatch. 35–38 s, 51–54 s, 91–94 s.                                                                                                                                                                                              |
| carrier / 6                      | original carrier.png 376×328 → 64×56                                               | Rotates ±90° for horizontal travel; no configured shots. Generic tiny shadow understates broad silhouette. Hit/destruction hook present; drops existing supply.                                                                                                | Scale shadow to broad hull, keep cue-free/non-shooting identity. 12–15, 30–33, 73–76, 114–117 s; show both travel directions and drop.                                                                                                                                                                                                         |
| escort / 12                      | scout 47×40 at depth4 + graphic side triangles at depth3, overall ≈70×40           | Explicit collage: stock body plus flat wings/nubs. Side charge points ±23/y+11, while 3-ray fan and delayed tails start at **center/y+20**. Body at4 hides hostile shots at3, even though bullet loop runs later.                                              | Replace unified hull at depth1; one geometry module for visible barrels and real emission. Decide center fan vs actual pods explicitly, not decorative fake weapons. 13–16, 59–62, 79–82, 87–90 s.                                                                                                                                             |
| brakeRaider / 6                  | generated enemy-brake 96×84 → 48×42                                                | Fixed rotation; gun sockets ±9/y+20 shared via raiderMuzzle for charge/model; engines ±7/y−15 with flame centered 4px above. First salvo while braking, second after departure.                                                                                | Already coherent. Verify both sides, first/second shot and hit flash; no new abstraction needed. 67–70, 83–86, 99–102 s.                                                                                                                                                                                                                       |
| hookWing / 6                     | generated enemy-hook 96×84 → 48×42                                                 | Fixed rotation while trajectory curves; same shared sockets. Removing cosmetic bank resolved previous socket/flame mismatch.                                                                                                                                   | Preserve nonrotating hull unless all sockets follow future bank. 79–82, 91–94, 107–110 s.                                                                                                                                                                                                                                                      |
| heavy / 2                        | heavy.png 331×336 → 70×61                                                          | Source PNG visibly has two forward gun barrels; display compresses height relative to source. Model fires 3 fan rays from center/y+20, not these barrels. Center charge also ambiguous.                                                                        | Unified gunship art with intentional center emitter or map fan to actual paired barrels while locking existing target rays. Avoid adding purple slabs. 88–93 and 106–111 s.                                                                                                                                                                    |
| turret / **0**                   | dormant branch heavy 56×49 tinted purple plus flat 8×23 rectangles ±21             | Supported Behavior but absent current Stage01 waves; center aimed source y+20 does not correspond to purple side pods.                                                                                                                                         | Record as dormant, do not claim current-stage visual coverage. Reuse upcoming gunship sockets if retained; isolated fixture only if branch repaired.                                                                                                                                                                                           |
| gatekeeper / 1                   | flat 98×58 rounded rectangle/pods + heavy 68×70 at depth4 + two fire03 engines at4 | Most obvious collage. Local charge ±39/y+32; left/right pattern bullets actually appear at arbitrary attackLanes (fractions of screen), y+24, **not on the aircraft**. Aim pattern center/y+24. Body/flames at4 hide shots at3. Shadow96×20 is broad but flat. | Unified patrol silhouette at1, barrels matching an explicit source helper. For lane fire, preserve aimed lane destinations but emit from actual sockets; lock trajectory at charge start. This changes path geometry, so needs model tests and route regression, not art-only approval. 40–49 s: all three cycles, moving body, real hit/kill. |
| groundBattery / 4                | original ground-base1254² →72² at depth0; rotating ground-turret1254² →48² at1     | Base intentionally static, head rotates −turretAngle, model/charge use groundMuzzle(sin a,cos a)\*20. Clear separation of foundation/head. Base does not flash when head hit. HUD visibility starts y108.                                                      | Current coordinate contract coherent; confirm cropped muzzle tip matches20px in actual art and low-FPS charging. 35–40 s, 73–79 s, before/after player-directed turn and destruction.                                                                                                                                                          |
| groundDepot / 1                  | ground-depot.png336×229 →70×48 at depth0                                           | Non-firing supply target, ground shadow/rim; damage-body hook present. No fake gun or warning.                                                                                                                                                                 | Keep non-firing identity and drop; verify opaque ground scenery does not cover active head at y108. 39–44 s.                                                                                                                                                                                                                                   |
| Boss / 1 + 2 breakable side pods | original boss528×357 →120×62 at1; generated cannon64×96 →32×48 at2                 | Core banks ±1°, added side pods/bridges stay axis-aligned. Source PNG already includes left/right guns, so added pods can read as duplicate weapons. Real side muzzle cannon.y+22 and center boss.y+28 correctly shared with charge.                           | Keep core unbanked or transform bridge roots with core; shared small geometry helper sufficient. Verify silhouette and duplicated baked guns in screenshot before repainting. 125–130 s entry/first fire, phase2/3, one/both pod deaths.                                                                                                       |

## Boss attachment and destroyed-state audit

- Side centers follow boss.x±68 / boss.y+20 each model update. Bridge starts at
  boss.x±40 / boss.y+5 and is drawn on background graphics (depth0); core1 and
  pods2 cover its ends. This is broadly sensible assembly order.
- Bridge is three lines (13px dark, 6px structural, 2px highlight). ±1° core bank
  moves visible shell edge but not bridge root. Small today, still an inconsistent
  transform. Do not rotate only pods to repair this.
- Destroyed cannon remains physically attached using `boss-cannon-broken`, has
  dim bridge middle and a low orange ember. Outer bridge highlight remains bright;
  consider dulling it after destruction. There is no wholesale disappearance.
- Model guard suppresses destroyed-pod rays and pending tails; shared charge
  helper omits that source. Hit flash uses the part object. Pod explosion0.45s;
  Boss destruction0.6s and ending-age playback. Verify both fire suppression and
  no new charge at the destroyed pod in exact-head video.
- Baked original Boss guns remain visible even when external pods break. If they
  read as functional barrels, remove/mute them in a dedicated hull asset rather
  than pretending their shots originate at external pods.

## Concrete occlusion findings

**Confirmed from depth order:** overlay hostile projectiles=3, impacts=2.7,
HUD=4.5, text=5. Generic aircraft1, Boss core1/pods2 are correctly below bullets.
However escort body4 and gatekeeper body/flames4 currently cover bullets.
Moving a draw loop later does not override Phaser object depth.

Other high-depth sprites also need explicit acceptance: falling weapon icons4
and short player installation icon4 can hide hostile bullets. Labels2.5 already
sit behind bullets. Resolve by lowering combat icons/bodies below3 or separating
hostile bullets onto a higher dedicated layer below4.5; don't raise all overlay
content indiscriminately because it also contains bars and charge indicators.

**Within the same overlay:** hostile bullets are drawn before later Boss bars,
charge marks and some player/module cues. Those later primitives can paint over
small bullet areas even though they share depth3. Minimal robust rule: draw
hostile projectile shapes last in their own graphics object or final overlay
pass, below HUD but above all world decoration. Impacts must remain below them.

## Reusable boundaries, not a new renderer framework

1. Per-hull immutable geometry: width/height, muzzle and engine local offsets;
   one local-to-world transform when a hull actually rotates. Reuse existing
   raiderMuzzle, groundMuzzle, bossMuzzle patterns, not a general ECS.
2. Art factory returns one coherent texture per hull/state; avoid unrelated PNG
   plus floating flat wings. Existing damage flash takes the same Image/body.
3. Separate attack direction from source location: ray angle is not a hull angle.
   Warning/source/first shot/tails must use one socket; aim may remain locked.
4. Keep one shared impact renderer (age/duration/seed) and a clear world-layer
   contract. Test high-depth exceptions explicitly rather than every sprite.

## Required exact-head CI page evidence

Capture normal and mobile layouts, not only source sprites or model snapshots:

- 17–24 s: weave/cross bank and firing; left/right directions.
- 35–40 s: rotating ground head; 40–49 s patrol charge/first/tails/hit/kill.
- 67–70 s brake; 79–82 s hook plus escort; 88–93 s heavy and dense overlap.
- 125–130 s Boss entry and side origin; phase2/3 and side-pod destruction.
- For each screenshot/video moment include enemy ID/behavior, time, sprite depth,
  dimensions/angle, visible muzzle and emitted origin. Keep real-health playable
  route separate from isolated visual fixtures; don't call invincible fixtures
  normal play. Test flash on body **and** coherent attachments, readable enemy
  bullets crossing silhouettes, one-hit/rapid-hit, kill and restart cleanup.

This audit does not assert visual fixes, browser verification or CI success.
Concurrent art/main changes must be reviewed against this inventory afterward.

## Implemented follow-up (new head pending)

- Escort and patrol replace unrelated PNG+flat wings/frame with complete original
  hull textures; patrol body and engines are below projectile depth3. The dormant
  air turret component is also authored coherently but is NOT a Stage01 spawn.
- Escort's original central fan source is preserved: its art now has a central
  three-aperture emitter at(0,+20); side pods are intakes/armor, not false guns.
- Patrol launches from actual ±39,+32 barrels toward its existing named left/right
  lane destinations at y540. Count, warning, cycle, speed and locked aim remain;
  this changes intermediate trajectories and requires normal-route regression.
- Shared enemyMount mirrors existing fast-craft swivelling sockets. Cross/weave
  now strafe upright rather than rotating only the hull away from their mounts;
  dive/carrier rotation remains. Heavy retains its central fan projector/source.
- Boss retains separate central weapon banks after side modules break; central
  guns are not asserted to be destroyed with the independently damageable pods.
  Original shoulder armor replaces bare connector lines; broken pod art remains.
- Hit feedback uses warm additive brightening instead of a solid FILL silhouette,
  preserving body details under rapid fire; pool reset and one-frame latch remain.
- Pickup/installation images move below enemy bullets; module shapes/labels stay.
  Section and pickup messages are mutually exclusive, avoiding the previous stack.
- Enemy render coverage is a fixed thirteen-kind counter, not per-frame history;
  unknown names collapse to straight. Evidence distinguishes actual Stage01 types
  from authored but currently unspawned components.

Rejected broad change: moving escort/fast/heavy origins together altered prior
route damage and one low-FPS survival check. No health or test assertions were
relaxed. Changes were isolated; only the patrol source correction remains, while
other visual sockets were aligned to their existing combat sources instead.

## Exact-head visual/CI follow-up (fd5ab7db)

PR run 44044168632 passed 322 unit and 23 browser tests. Push run44044160587
passed22/23 browser tests, but the normal touch pilot lost at43.7s. The video
shows prior damage in the crossing segment, not only the final patrol shot.
Do not deploy by selecting only the green run. Test control latency separately
from model update frequency, without changing health, bullets or assertions.

New hulls remove the detached escort triangles/patrol box. Their code-drawn
material is still flatter than the source scout art: style acceptance remains
open. `boss-phase3.png` contains a rectangular missing left body; continuous
video also contains transient rectangles in HUD/menus. No cropping/masking is
used in the sprite pool. Add post-render framebuffer captures alongside the
original compositor screenshots before attributing this to assets or declaring
it fixed. Preserve original evidence, not just a better-looking replacement.

### Renderer/control follow-up (after84560eb9)

The PR run passed342/23. The push touch route reached the Boss but failed an
unconditional primary-touch assertion after the second bomb. `useBomb` can
synchronously finish the Boss; the next UI update must clear touch and persist
victory. The revised test distinguishes continued play from verified victory,
rejects all other states, and retains the independent multi-touch test.

Native post-render `readPixels` captures also showed transient missing
rectangles in text/projectiles. This is not sufficient to blame the compositor
or declare a damaged image asset. The next experiment constrains Phaser's
public `render.maxTextures` to1, keeping content/effects/simulation unchanged,
and captures8 native frames. Retain only after full-route CI, visual and CPU
cost checks; it is a compatibility experiment, not a proven upstream root cause.
