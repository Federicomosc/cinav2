/** Swipe orizzontale per cambiare giorno (touch). */
export interface DaySwipeOpts {
  onNext: () => void;
  onPrev: () => void;
  canNext: () => boolean;
  canPrev: () => boolean;
  onDrag?: (dx: number) => void;
  onDragEnd?: () => void;
}

const THRESHOLD = 52;
const LOCK = 10;
const MAX_DRAG = 96;

export function daySwipe(node: HTMLElement, opts: DaySwipeOpts) {
  let startX = 0;
  let startY = 0;
  let locked: 'h' | 'v' | null = null;

  function onStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    locked = null;
  }

  function onMove(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (!locked) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      locked = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    }

    if (locked !== 'h') return;

    e.preventDefault();
    let x = dx;
    if (dx < 0 && !opts.canNext()) x *= 0.22;
    if (dx > 0 && !opts.canPrev()) x *= 0.22;
    opts.onDrag?.(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, x)));
  }

  function onEnd(e: TouchEvent) {
    if (locked !== 'h') {
      opts.onDragEnd?.();
      locked = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - startX;
    opts.onDragEnd?.();
    if (dx < -THRESHOLD && opts.canNext()) opts.onNext();
    else if (dx > THRESHOLD && opts.canPrev()) opts.onPrev();
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
