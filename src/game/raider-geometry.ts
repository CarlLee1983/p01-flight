/** Fixed down-facing airframes; movement curves do not rotate their sockets. */
export const RAIDER_GEOMETRY = {
  width: 48,
  height: 42,
  gunX: 9,
  gunY: 20,
  engineX: 7,
  engineY: -15,
} as const;
export function raiderMuzzle(e: { x: number; y: number }, index: number) {
  return {
    x: e.x + (index === 0 ? -1 : 1) * RAIDER_GEOMETRY.gunX,
    y: e.y + RAIDER_GEOMETRY.gunY,
  };
}
