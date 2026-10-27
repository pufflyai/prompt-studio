import type { CanvasRuntime } from "./runtime";

// Viewport navigation belongs to @pstdio/ui/canvas. UI Canvas only owns frame movement.
export const installItemMovement = (shell: HTMLElement, runtime: CanvasRuntime) => {
  let drag: { pointer: number; id: string; x: number; y: number; handle: HTMLElement } | undefined;
  const finish = () => {
    const current = drag;
    drag = undefined;
    if (current?.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
    runtime.flush();
  };
  const down = (event: PointerEvent) => {
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-canvas-handle]") : null;
    if (!handle || event.button !== 0 || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    handle.focus({ preventScroll: true });
    drag = { pointer: event.pointerId, id: handle.dataset.canvasHandle!, x: event.clientX, y: event.clientY, handle };
    handle.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const zoom = runtime.get().camera.zoom;
    runtime.move(drag.id, { x: (event.clientX - drag.x) / zoom, y: (event.clientY - drag.y) / zoom });
    drag.x = event.clientX;
    drag.y = event.clientY;
    event.preventDefault();
    event.stopPropagation();
  };
  const end = (event: PointerEvent) => {
    if (drag?.pointer === event.pointerId) finish();
  };
  const key = (event: KeyboardEvent) => {
    const handle =
      event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-canvas-handle]") : null;
    if (!handle || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 40 : 8;
    const delta = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    runtime.move(handle.dataset.canvasHandle!, delta);
  };
  const focus = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement) runtime.revealFocus(event.target);
  };
  shell.addEventListener("pointerdown", down);
  shell.addEventListener("pointermove", move);
  shell.addEventListener("pointerup", end);
  shell.addEventListener("pointercancel", end);
  shell.addEventListener("lostpointercapture", end);
  shell.addEventListener("keydown", key);
  shell.addEventListener("focusin", focus);
  window.addEventListener("blur", finish);
  return () => {
    finish();
    shell.removeEventListener("pointerdown", down);
    shell.removeEventListener("pointermove", move);
    shell.removeEventListener("pointerup", end);
    shell.removeEventListener("pointercancel", end);
    shell.removeEventListener("lostpointercapture", end);
    shell.removeEventListener("keydown", key);
    shell.removeEventListener("focusin", focus);
    window.removeEventListener("blur", finish);
  };
};
