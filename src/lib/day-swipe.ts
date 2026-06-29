/** Swipe orizzontale per cambiare giorno (touch). */
export interface DaySwipeOpts {
  canNext: () => boolean;
  canPrev: () => boolean;
  onDrag?: (dx: number) => void;
  onRelease?: (commit: 'next' | 'prev' | null) => void;
}

const THRESHOLD = 42;
const FLICK = 0.32;
const LOCK = 8;
const MAX_DRAG = 140;

function rubberBand(x: number, atEdge: boolean): number {
  if (!atEdge) return x;
  const sign = Math.sign(x);
  const a = Math.abs(x);
  return sign * (a * 0.16 + (a * a) / MAX_DRAG * 0.1);
}

export function daySwipe(node: HTMLElement, opts: DaySwipeOpts) {
  let startX = 0;
  let startY = 0;
  let locked: 'h' | 'v' | null = null;
  let lastX = 0;
  let lastT = 0;
  let vx = 0;

  function onStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    lastX = startX;
    lastT = performance.now();
    vx = 0;
    locked = null;
  }

  function onMove(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const cx = e.touches[0].clientX;
    const cy = e.touches[0].clientY;
    const dx = cx - startX;
    const dy = cy - startY;

    if (!locked) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      locked = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'h' : 'v';
    }

    if (locked !== 'h') return;

    e.preventDefault();

    const now = performance.now();
    const dt = Math.max(now - lastT, 8);
    vx = 0.65 * vx + 0.35 * ((cx - lastX) / dt);
    lastX = cx;
    lastT = now;

    let x = dx;
    if (dx < 0) x = rubberBand(dx, !opts.canNext());
    else if (dx > 0) x = rubberBand(dx, !opts.canPrev());

    opts.onDrag?.(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, x)));
  }

  function onEnd(e: TouchEvent) {
    if (locked !== 'h') {
      opts.onRelease?.(null);
      locked = null;
      return;
    }

    const dx = e.changedTouches[0].clientX - startX;
    let commit: 'next' | 'prev' | null = null;

    if ((dx < -THRESHOLD || vx < -FLICK) && opts.canNext()) commit = 'next';
    else if ((dx > THRESHOLD || vx > FLICK) && opts.canPrev()) commit = 'prev';

    opts.onRelease?.(commit);
    locked = null;
  }

  node.addEventListener('touchstart', onStart, { passive: true });
  node.addEventListener('touchmove', onMove, { passive: false });
  node.addEventListener('touchend', onEnd, { passive: true });
  node.addEventListener('touchcancel', onEnd, { passive: true });

  return {
    update(next: DaySwipeOpts) {
      opts = next;
    },
    destroy() {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    },
  };
}
