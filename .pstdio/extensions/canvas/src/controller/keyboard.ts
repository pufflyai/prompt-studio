import type { CanvasRuntime } from "./runtime";
export const navigateWithKeyboard = (event: KeyboardEvent, shell: HTMLElement, runtime: CanvasRuntime) => {
  const target = event.target instanceof Element ? event.target : null;
  const handle = target?.closest<HTMLElement>("[data-canvas-handle]");
  if (event.ctrlKey || event.metaKey || event.altKey || (!handle && event.target !== shell)) return;
  const step = event.shiftKey ? 50 : 10;
  const directions: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  };
  const direction = directions[event.key];
  if (direction) {
    event.preventDefault();
    if (handle) {
      runtime.move(handle.dataset.canvasHandle!, direction);
      runtime.revealFocus(handle);
    } else runtime.pan({ x: -direction.x, y: -direction.y });
    return;
  }
  if (handle) return;
  const zoomIn = () => runtime.zoom(1.2);
  const actions: Record<string, () => void> = {
    "+": zoomIn,
    "=": zoomIn,
    "-": () => runtime.zoom(1 / 1.2),
    "0": runtime.reset,
    f: runtime.fit,
  };
  const action = actions[event.key.toLowerCase()];
  if (action) {
    event.preventDefault();
    action();
  }
};
