/**
 * Spatial-UI button press that works with hands. Fires on the pinch itself
 * (pointerdown), not on release: with hand tracking the ray drifts while the
 * fingers close, so a release often lands off the button and would be lost.
 * A short guard stops one pinch from firing twice.
 */
const GUARD_MS = 350;

interface PressTarget {
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
}

export function onPress(el: PressTarget | undefined | null, fn: () => void, cleanups: (() => void)[]): boolean {
  if (!el) return false;
  let last = 0;
  const down = () => {
    const now = performance.now();
    if (now - last < GUARD_MS) return;
    last = now;
    fn();
  };
  el.addEventListener('pointerdown', down);
  cleanups.push(() => el.removeEventListener('pointerdown', down));
  return true;
}
