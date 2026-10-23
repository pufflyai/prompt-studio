import type { CanvasNavigation, CanvasPoint } from "./canvas.types";

interface TouchOptions {
  viewport: HTMLElement;
  navigation: () => CanvasNavigation;
  hasPointer: () => boolean;
  finishPointer: () => void;
  markMoved: () => void;
  finish: () => void;
}
export const installCanvasTouch = (options: TouchOptions) => {
  const { viewport, navigation, hasPointer, finishPointer, markMoved, finish } = options;
  let previous: { center: CanvasPoint; distance: number } | undefined;
  let bounds = { left: 0, top: 0 };
  const position = (touches: TouchList) => ({
    center: {
      x: (touches[0].clientX + touches[1].clientX) / 2 - bounds.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - bounds.top,
    },
    distance: Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY),
  });
  const cancel = () => {
    if (previous) finish();
    previous = undefined;
  };
  const start = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      // Only an owned background gesture blocks native one-finger preview scrolling.
      if (hasPointer() && event.cancelable) event.preventDefault();
      return;
    }
    cancel();
    if (event.touches.length !== 2 || !event.cancelable) return;
    if (![...event.touches].every((touch) => touch.target instanceof Node && viewport.contains(touch.target))) return;
    finishPointer();
    bounds = viewport.getBoundingClientRect();
    previous = position(event.touches);
    event.preventDefault();
  };
  const move = (event: TouchEvent) => {
    if (!previous || event.touches.length !== 2) return;
    if (!event.cancelable) {
      cancel();
      return;
    }
    const next = position(event.touches);
    event.preventDefault();
    markMoved();
    navigation().onZoom({
      factor: next.distance / Math.max(1, previous.distance),
      anchor: previous.center,
      targetAnchor: next.center,
    });
    previous = next;
  };
  viewport.addEventListener("touchstart", start, { passive: false });
  viewport.addEventListener("touchmove", move, { passive: false });
  viewport.addEventListener("touchend", cancel);
  viewport.addEventListener("touchcancel", cancel);
  return {
    cancel,
    dispose: () => {
      cancel();
      viewport.removeEventListener("touchstart", start);
      viewport.removeEventListener("touchmove", move);
      viewport.removeEventListener("touchend", cancel);
      viewport.removeEventListener("touchcancel", cancel);
    },
  };
};
