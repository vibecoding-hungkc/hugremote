interface TerminalScrollTarget {
  element: HTMLElement | null | undefined;
  rows?: number;
}

function wheelTarget(term: TerminalScrollTarget): HTMLElement | null {
  if (!term.element) return null;
  return term.element.querySelector<HTMLElement>('.xterm-screen') || term.element;
}

export function dispatchTerminalWheel(term: TerminalScrollTarget, deltaY: number): boolean {
  if (!Number.isFinite(deltaY) || deltaY === 0) return false;
  const target = wheelTarget(term);
  if (!target || typeof WheelEvent === 'undefined') return false;

  const rect = target.getBoundingClientRect();
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    composed: true,
    deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    deltaY,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });
  // Xterm v6's normal scrollback prioritizes Chromium's legacy wheelDeltaY,
  // whose polarity is the inverse of deltaY. Its tmux mouse path reads deltaY.
  Object.defineProperty(event, 'wheelDeltaY', {
    configurable: true,
    value: -deltaY,
  });
  target.dispatchEvent(event);
  return true;
}

export function attachTerminalTouchScrolling(
  container: HTMLElement,
  getTerminal: () => TerminalScrollTarget | null,
): () => void {
  let lastY: number | null = null;

  const onTouchStart = (event: TouchEvent) => {
    lastY = event.touches.length === 1 ? event.touches[0].clientY : null;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      lastY = null;
      return;
    }
    if (lastY === null) return;
    const terminal = getTerminal();
    if (!terminal) return;

    const currentY = event.touches[0].clientY;
    const deltaY = lastY - currentY;
    lastY = currentY;
    if (dispatchTerminalWheel(terminal, deltaY)) {
      event.preventDefault();
    }
  };

  const resetTouch = () => {
    lastY = null;
  };

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', resetTouch, { passive: true });
  container.addEventListener('touchcancel', resetTouch, { passive: true });

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', resetTouch);
    container.removeEventListener('touchcancel', resetTouch);
  };
}
