# P01 rotating ground artillery assets

Generated with the built-in image_gen tool on 2026-11-17. Original game asset styling referenced from existing original ground-battery.png, no third-party art added. No repository edits or deployment performed.

## Selected files

- ground-base.png: fixed octagonal armored steel/olive/sand-gray base with empty central bearing, top-down orthographic, transparent RGBA.
- ground-turret.png (selected source ground-turret-centered.png): independent single central barrel turret, matching mechanical styling, top-down orthographic, transparent RGBA.
- Discarded source ground-turret.png was not imported; the repository ground-turret.png instead contains the corrected centered source listed above.

Both selected files are 1254×1254. Mechanical hull center is visually near (627,627). The centered turret bore is near (627,1148), approximately 521 pixels below pivot. At 48px display height this is ~19.94px, matching a 20px game muzzle. These positions are visually estimated, not automated semantic recognition. Use center origin and initially 48px turret display height; fixed base can display 80–90px (its visible silhouette occupies ~75% canvas). Final game integration must verify exact muzzle flash alignment and rotating pivot.

## Prompts

Base: Create ONE fixed base only, genuine alpha, strict directly overhead orthographic, centered octagonal armor, central dark circular mounting surface, matching subdued steel/olive/sand gray semi-realistic machinery; no gun/barrel/turret/floor/text/logo/shadow outside object.
Turret: Create ONE independent rotating turret with single central down-facing barrel; preserve subdued armored style; rotational head center requested at image center and muzzle at 90% image height; no fixed base, floor, text, UI or glow.
Targeted alignment edit: Move circular head center down to exact image center, retain muzzle near 90% height by shortening barrel; preserve materials, silhouette style and transparent background.

## Verified / limits

Viewed full-size generated images. Alpha channel contains true 0 and 255 values; visible threshold bbox, file size and SHA256 are in validation.json. Alignment improved after one targeted edit. No in-engine play, thumbnail legibility, runtime performance or animation inspection claimed. Parent owns game integration and final validation.
