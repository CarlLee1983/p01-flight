# Weapon capsules and distinct squadrons

This first-stage increment responds to feedback requesting more meaningful weapon packages and recognizable enemies. Stage length, boss values, controls and localStorage v1 remain unchanged.

## Choice and growth

Six original code-drawn capsule icons use different silhouettes and symbols, not just colors: healing cross, P power diamond, S spread fan, B beam rails, M guided missile triangle, W paired-wing support. The title screen shows the legend; collected items briefly announce their effect in the playfield.

S/B/M pickups select the matching main weapon and increase the shared level (cap 3). C still cycles all three modes freely: the player is not locked out by missing a drop. Power raises the same shared level; healing remains separate. Support grants two small escort drones for eight seconds. They fire only with the player's fire button, do not collide or shield the player, and repeat pickups refresh rather than stack the timer. This adds a temporary width/positioning advantage without a fourth recolored main weapon.

Supply aircraft cross slowly at 12/30/48 seconds and drop an S/B/M capsule when destroyed. The central support supply arrives at 39 seconds and reaches a stationary player's pickup range around 44.35 seconds. It is an optional aid, not required for the original winning route.

## Enemy art

A new narrow purple interceptor silhouette is used for crossing and committed dive attacks. A bronze twin-cargo transport has a distinct broad body for supply runs. Both are original generated transparent assets, documented in original-art-production.md. All five prior assets remain unchanged. Sprite proportions preserve the new source shapes; model hitboxes remain separate.

## Verification boundary

Local typecheck, build and 76 unit tests passed during integration. Unit routes at 30/60/120 FPS cover capsule behavior, escort expiry/pause/no shielding, exact carrier drops and normal first-stage wins. Browser E2E adds actual keyboard interception/capsule collection and visible escort firing in the normal full-stage run. Final exact-head CI, video and screenshots are required before delivery. Human feel, audio audition and player-device performance are not implied by machine tests.
