import { zoomAt } from "./geometry";
import type { CanvasRuntime } from "./runtime";
export const installTouch = (shell: HTMLElement, runtime: CanvasRuntime, endPointer: () => void) => {
  let previous: { x: number; y: number; distance: number } | undefined;
  const points = (touches: TouchList) => {
    const rect = shell.getBoundingClientRect();
    const a = touches[0];
    const b = touches[1];
    return {
      x: (a.clientX + b.clientX) / 2 - rect.left,
      y: (a.clientY + b.clientY) / 2 - rect.top,
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    };
  };
  const start = (event: TouchEvent) => {
    if (event.touches.length !== 2) {
      previous = undefined;
      return;
    }
    endPointer();
    previous = points(event.touches);
  };
  const move = (event: TouchEvent) => {
    if (event.touches.length !== 2 || !previous) return;
    if (!event.cancelable) {
      previous = undefined;
      return;
    }
    event.preventDefault();
    const next = points(event.touches);
    const zoom = zoomAt(
      runtime.get().camera,
      previous,
      (runtime.get().camera.zoom * next.distance) / Math.max(1, previous.distance),
    );
    runtime.camera({ ...zoom, x: zoom.x + next.x - previous.x, y: zoom.y + next.y - previous.y });
    previous = next;
  };
  const end = (event: TouchEvent) => {
    previous = event.touches.length === 2 ? points(event.touches) : undefined;
    runtime.flush();
  };
  shell.addEventListener("touchstart", start, { passive: true });
  shell.addEventListener("touchmove", move, { passive: false });
  shell.addEventListener("touchend", end);
  shell.addEventListener("touchcancel", end);
  return () => {
    shell.removeEventListener("touchstart", start);
    shell.removeEventListener("touchmove", move);
    shell.removeEventListener("touchend", end);
    shell.removeEventListener("touchcancel", end);
  };
};
