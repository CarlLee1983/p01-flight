export const NEXT_ASSETS = [
  "boss-canyon",
  "boss-polar",
  "enemy-outrider",
  "enemy-bomber",
  "missile-truck-base",
  "missile-truck-head",
  "flak-head",
  "polar-river",
  "polar-bridge",
  "polar-mine",
  "polar-dam",
  "polar-reservoir",
] as const;
export function nextAssetStatus(textures: {
  exists(key: string): boolean;
  get(key: string): { source?: { image?: unknown }[] } | undefined;
}) {
  return NEXT_ASSETS.map((key) => ({
    key,
    ready: textures.exists(key),
    bitmap:
      textures.exists(key) &&
      typeof HTMLImageElement !== "undefined" &&
      textures.get(key)?.source?.[0]?.image instanceof HTMLImageElement,
  }));
}
