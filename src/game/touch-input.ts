export interface TouchPoint {
  x: number;
  y: number;
}
export type TouchScale = number | TouchPoint;
export interface TouchSample {
  /** Direction fractions. Pass target to FlightModel to preserve small distances. */
  dx: number;
  dy: number;
  fire: boolean;
  target?: TouchPoint;
  /** Capped preview only; never assign this directly to the model player. */
  next: TouchPoint;
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * One-finger relative drag, independent of DOM and rendering.
 * The caller owns setPointerCapture/releasePointerCapture. Only call begin while
 * playing; call cancel on blur/pause/end-of-run and resize on viewport changes.
 * Scale is CSS pixels per logical pixel, not devicePixelRatio.
 */
export class TouchInput {
  private pointer: number | null = null;
  private origin: TouchPoint = { x: 0, y: 0 };
  private playerOrigin: TouchPoint = { x: 0, y: 0 };
  private scale: TouchPoint = { x: 1, y: 1 };
  private destination: TouchPoint | undefined;
  constructor(
    private width = 360,
    private height = 640,
  ) {}
  get pointerId() {
    return this.pointer;
  }
  get active() {
    return this.pointer !== null;
  }
  get target(): TouchPoint | undefined {
    return this.destination ? { ...this.destination } : undefined;
  }
  begin(
    id: number,
    clientX: number,
    clientY: number,
    playerX: number,
    playerY: number,
    scale: TouchScale,
  ): boolean {
    const factors = typeof scale === "number" ? { x: scale, y: scale } : scale;
    if (
      this.active ||
      ![id, clientX, clientY, playerX, playerY, factors.x, factors.y].every(
        Number.isFinite,
      ) ||
      factors.x <= 0 ||
      factors.y <= 0
    )
      return false;
    this.pointer = id;
    this.origin = { x: clientX, y: clientY };
    this.playerOrigin = { x: playerX, y: playerY };
    this.scale = { ...factors };
    this.destination = this.bounded(this.playerOrigin);
    return true;
  }
  move(id: number, clientX: number, clientY: number): boolean {
    if (
      id !== this.pointer ||
      !this.active ||
      !Number.isFinite(clientX) ||
      !Number.isFinite(clientY)
    )
      return false;
    this.destination = this.bounded({
      x: this.playerOrigin.x + (clientX - this.origin.x) / this.scale.x,
      y: this.playerOrigin.y + (clientY - this.origin.y) / this.scale.y,
    });
    return true;
  }
  end(id: number): boolean {
    if (!this.active || id !== this.pointer) return false;
    this.cancel();
    return true;
  }
  cancel() {
    this.pointer = null;
    this.destination = undefined;
  }
  reset() {
    this.cancel();
  }
  resize() {
    this.cancel();
  }
  sample(player: TouchPoint, dt: number, speed = 240): TouchSample {
    const target = this.target;
    const step =
      (Number.isFinite(speed) ? Math.max(0, speed) : 0) *
      (Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0);
    if (!this.active || !target)
      return { dx: 0, dy: 0, fire: false, next: { ...player } };
    const x = target.x - player.x,
      y = target.y - player.y;
    const distance = Math.hypot(x, y);
    const travel = Math.min(step, distance);
    const dx = distance > 0 && step > 0 ? ((x / distance) * travel) / step : 0;
    const dy = distance > 0 && step > 0 ? ((y / distance) * travel) / step : 0;
    return {
      dx,
      dy,
      fire: true,
      target,
      next: { x: player.x + dx * step, y: player.y + dy * step },
    };
  }
  private bounded(point: TouchPoint): TouchPoint {
    return {
      x: clamp(point.x, 18, this.width - 18),
      y: clamp(point.y, 70, this.height - 24),
    };
  }
}
