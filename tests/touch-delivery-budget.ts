/** Test-driver latency estimate only. Changed-target dispatch is the expensive
 * path in CI; a quick no-op must not erase its observed peak. This deliberately
 * retains the existing 0.3s policy ceiling, not a claim to model longer stalls. */
export function touchDeliveryBudget(
  previous: number,
  changed: boolean,
  observedSeconds: number,
): number {
  const old = Math.max(0.2, Math.min(0.3, previous));
  return changed && Number.isFinite(observedSeconds)
    ? Math.max(old, Math.min(0.3, Math.max(0, observedSeconds) * 1.25))
    : old;
}
