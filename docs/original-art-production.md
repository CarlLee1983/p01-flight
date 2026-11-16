# Stage 01 original art production

Created 2026-11-16 using the built-in OpenAI image generation tool for this project. These are original prompted assets, not copied game graphics and not third-party CC0 assets. No third-party reference image was supplied. This provenance does not assert exclusive copyright or a third-party license grant.

## Art direction

Orthographic top-down near-future military arcade, hard-surface painted/prerendered 2D detail; shared upper-left lighting. Silver/navy/cyan identifies the player, vermilion identifies interceptors, ochre identifies heavy armor, burgundy/gunmetal identifies the boss. Enemy craft face down; player faces up. Ground is restrained dark teal with low-contrast port infrastructure.

## Files

| File under public/assets/original |       Size | Alpha | Intent                                                                   |
| --------------------------------- | ---------: | ----- | ------------------------------------------------------------------------ |
| player.png                        |  272 × 270 | RGBA  | Silver-white cyan-tipped fighter, up-facing                              |
| scout.png                         |  272 × 231 | RGBA  | Broad crescent vermilion interceptor, down-facing                        |
| heavy.png                         |  331 × 336 | RGBA  | Ochre square-shouldered twin-cannon gunship, down-facing                 |
| boss.png                          |  528 × 357 | RGBA  | Burgundy command fortress with paired guns and central core, down-facing |
| coast.png                         | 720 × 1080 | RGB   | Dark ocean channel, industrial piers and rocky coastline                 |

Generated images were mechanically trimmed/scaled and padded for runtime delivery with ImageMagick. Full-resolution originals remain in the generation workspace; no repainting or borrowed artwork was used. Single-frame hulls are intended for runtime banking, recoil, exhaust and hit effects. They are NOT claimed as hand-authored frame animation or mechanically accurate vehicles.

## Generation prompts

Shared sprite specification: “Production game asset for original top-down vertical scrolling military sci-fi arcade shooter. STRICT ORTHOGRAPHIC TOP VIEW. Cohesive high-detail hand-painted prerendered 2D arcade sprite, hard-surface bevels and restrained metal shading, light from top-left. Strong readable silhouette at gameplay size. Entire craft centered with transparent margin. No exhaust flames, no shadow outside object, no floor, no lettering, no logos, no weapons firing. Actual transparent alpha background. Single craft only.”

- Player: nose UP, symmetric wings, compact silver-white fighter with dark navy panels, cyan wing tips, dark glass canopy, twin rear engines, short swept wings and forward canards.
- Scout: nose DOWN, symmetric crescent swept wings, rust-vermilion armor, gunmetal ribs, amber canopy, wide aggressive silhouette and two rear engines.
- Heavy: nose and cannons DOWN, broad square shoulders, two armored wing nacelles with cylindrical cannons, four rear exhausts, muted ochre plates and orange vents.
- Boss: nose and cannons DOWN, wide winged fortress, large armored side pods, articulated wing panels, scarlet reactor core, dark command bridge, paired lower guns, four rear engines, dark steel and burgundy accents. Follow-up edit requested removal of outside glow/shadow while preserving design and transparency.
- Coast: portrait top-down industrial coastline, center ocean occupying roughly 65 percent, wave patterns, rocky shore, piers, roads, hangars, pipes and tanks; low contrast dark teal/slate/olive. No aircraft, ships, firing, explosions, HUD, text or logos.

## Validation and limitations

- All five generated images visually inspected in full. The four hull files contain genuine variable alpha with transparent background pixels.
- Boss composited over a solid teal inspection background and visually checked: no rectangular matte or ambient glow remains visible outside the craft silhouette. RGB content of transparent pixels can look misleading in viewers that ignore alpha; preserve RGBA.
- Coast is NOT seamless. Use a finite camera travel, transition or crossfade; do not claim seamless looping. Coast has painted ground structures rather than a transparent parallax layer.
- Keep runtime aspect ratios; do not squash the player's silhouette into an arbitrary square. Rendered art size and collision core are separate design decisions; make the hit core visible in precision movement.
- Ground color contrast and sprite scale must still be inspected in the integrated running scene against enemy bullets and effects. This asset check is not gameplay/readability acceptance.
- Source PNG size total is approximately 1.7 MB; no performance claim has been measured.
  c5724c965d4f7f8d7ac4b20eee7c042e9bf65d6c5e9369480c1a5a12c160b9b7 p01-flight/public/assets/original/boss.png
  cda9ce41e96dd3596c927fcb87fd316e267ac91f35c46f05682c1fa15d3e39d6 p01-flight/public/assets/original/coast.png
  e48606d1c6e5dfcf7249721a46f2476b07c268e72e68cb359308b95f9b14cdc6 p01-flight/public/assets/original/heavy.png
  b86af286efe6e855893fe80d3f265a3cff4af31c9c0f95dd0834baa72a3340d4 p01-flight/public/assets/original/player.png
  a0767662073dfc305b48256c65bda943b01eae91f815451dff6a13c7811465c7 p01-flight/public/assets/original/scout.png

## Additional distinct enemy silhouettes (2026-11-16)

Created with the same built-in OpenAI image generation tool, no external reference imagery. The original five assets were not changed.

| Asset           | Runtime PNG size | Silhouette / role                                                                                                            |
| --------------- | ---------------: | ---------------------------------------------------------------------------------------------------------------------------- |
| interceptor.png |   252 × 376 RGBA | Down-facing elongated violet spearhead with narrow fuselage and dagger wings, intended for dive/cross behavior               |
| carrier.png     |   376 × 328 RGBA | Down-facing bronze-gray box drone with two broad cargo pods and four rear engines, intended for slow supply-carrier behavior |

Prompts: interceptor requested strict orthographic top view, nose down, narrow elongated spearhead, swept dagger wings, long dark cockpit, twin slim rear thrusters, violet/charcoal armor, upper-left light, original mechanical 2D arcade style, real transparent alpha, no text/exhaust/exterior shadow. Carrier requested the same view/style/light, a broad rectangular blunt industrial hull with two armored cargo boxes, four rear engine blocks, small forward robotic sensor, bronze/warm gray/gunmetal palette and amber running lights; no fighter-like wings.

Both mechanically trimmed/scaled and padded for runtime use. Both visually checked after compositing RGBA over a solid teal background: no rectangular matte or ambient glow outside the hull. They are single-frame hull art, not authored animation frames. Keep aspect ratio so the interceptor remains narrow/long and the carrier broad/blunt; collision extents should be independently tuned to visible silhouettes. Integration behavior, movement and bullet readability remain the developer's runtime checks.

Hashes:
3e4f76187863fd8986cc17ce4b994a0cd347cf70341325ae0ad04a7f75b59b42 p01-flight/public/assets/original/interceptor.png
ac02a1efca41b742c9def19bca47566a7110d5d160f8d29db90652364e85ab0c p01-flight/public/assets/original/carrier.png
