/** Preloaded coherent bitmap hulls override the legacy canvas fallbacks.
 * Display sizes, collision bodies and weapon origins remain the existing contract.
 * Four-times display resolution; uploaded once, never rebaked per frame. */
export const METAL_SPRITES = [
  { key: "enemy-hook", file: "enemy-hook-metal", width: 192, height: 168 },
  { key: "enemy-brake", file: "enemy-brake-metal", width: 192, height: 168 },
  { key: "enemy-patrol", file: "enemy-patrol-metal", width: 416, height: 304 },
  { key: "boss-cannon", file: "boss-cannon-metal", width: 128, height: 192 },
  { key: "boss-cannon-broken", file: "boss-cannon-broken-metal", width: 128, height: 192 },
  { key: "enemy-escort", file: "enemy-escort-metal", width: 280, height: 176 },
  { key: "enemy-gunship", file: "enemy-gunship-metal", width: 224, height: 196 },
].map(spec => ({...spec, path: `assets/original/${spec.file}.webp` }));
