/** Phaser may revisit its pending queue on another DOM event before postUpdate.
 * Deduplicate by event identity, not a timer: distinct fast presses still work.
 * WeakSet does not retain the lifetime history of keyboard events. */
export function keyboardEdge<T extends { repeat: boolean }>(action: (event: T) => void) {
  const handled = new WeakSet<T>();
  return (event: T) => {
    if (event.repeat || handled.has(event)) return;
    handled.add(event);
    action(event);
  };
}
