import type { CanvasNavigation, CanvasPoint } from "./canvas.types";
import { isCanvasControl } from "./canvas-targets";

interface TouchOptions {
  viewport: HTMLElement;
  navigation: () => CanvasNavigation;
  pan: (delta: CanvasPoint) => boolean;
  markMoved: () => void;
  finish: () => void;
}
export const installCanvasTouch = (options: TouchOptions) => {
  const { viewport, navigation, pan, markMoved, finish } = options;
  let gesture:
    | { kind: "pan"; point: CanvasPoint }
    | { kind: "pinch"; center: CanvasPoint; distance: number }
    | undefined;
  let bounds = { left: 0, top: 0 };
  const position = (touches: TouchList) => ({
    center: {
      x: (touches[0].clientX + touches[1].clientX) / 2 - bounds.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - bounds.top,
    },
    distance: Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY),
  });
  const cancel = () => {
    if (gesture) finish();
    gesture = undefined;
  };
  const start = (event: TouchEvent) => {
    if (event.defaultPrevented || !event.cancelable) return;
    if (event.touches.length === 1) {
      // Preview controls keep native one-finger scrolling.
      if (isCanvasControl(event.target)) return;
      const touch = event.touches[0];
      gesture = { kind: "pan", point: { x: touch.clientX, y: touch.clientY } };
      viewport.focus({ preventScroll: true, focusVisible: false });
      event.preventDefault();
      return;
    }
    if (event.touches.length !== 2) {
      cancel();
      return;
    }
    if (![...event.touches].every((touch) => touch.target instanceof Node && viewport.contains(touch.target))) return;
    bounds = viewport.getBoundingClientRect();
    gesture = { kind: "pinch", ...position(event.touches) };
    event.preventDefault();
  };
  const move = (event: TouchEvent) => {
    if (event.defaultPrevented || !gesture) return;
    if (!event.cancelable) {
      cancel();
      return;
    }
    event.preventDefault();
    if (gesture.kind === "pan") {
      const touch = event.touches[0];
      const delta = { x: touch.clientX - gesture.point.x, y: touch.clientY - gesture.point.y };
      if (pan(delta)) gesture.point = { x: touch.clientX, y: touch.clientY };
      return;
    }
    const next = position(event.touches);
    markMoved();
    navigation().onZoom({
      factor: next.distance / Math.max(1, gesture.distance),
      anchor: gesture.center,
      targetAnchor: next.center,
    });
    gesture = { kind: "pinch", ...next };
  };
  const end = (event: TouchEvent) => {
    if (!gesture) return;
    if (gesture.kind === "pinch" && event.touches.length === 1) {
      const touch = event.touches[0];
      gesture = { kind: "pan", point: { x: touch.clientX, y: touch.clientY } };
    } else cancel();
  };
  viewport.addEventListener("touchstart", start, { passive: false });
  viewport.addEventListener("touchmove", move, { passive: false });
  viewport.addEventListener("touchend", end);
  viewport.addEventListener("touchcancel", cancel);
  return {
    cancel,
    dispose: () => {
      cancel();
      viewport.removeEventListener("touchstart", start);
      viewport.removeEventListener("touchmove", move);
      viewport.removeEventListener("touchend", end);
      viewport.removeEventListener("touchcancel", cancel);
    },
  };
};
