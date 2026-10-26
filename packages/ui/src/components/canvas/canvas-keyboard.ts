import type { CanvasNavigation } from "./canvas.types";

export const navigateCanvasKey = (event: KeyboardEvent, viewport: HTMLElement, navigation: CanvasNavigation) => {
  if (event.target !== viewport) return false;
  const step = event.shiftKey ? 320 : 80;
  const directions: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: step, y: 0 },
    ArrowRight: { x: -step, y: 0 },
    ArrowUp: { x: 0, y: step },
    ArrowDown: { x: 0, y: -step },
  };
  const zoom = (factor: number) => () =>
    navigation.onZoom({ factor, anchor: { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 } });
  const actions: Record<string, (() => void) | undefined> = {
    "+": zoom(1.2),
    "=": zoom(1.2),
    "-": zoom(1 / 1.2),
    f: navigation.onFit,
    "0": navigation.onReset,
  };
  const direction = directions[event.key];
  const action = direction ? () => navigation.onPan(direction) : actions[event.key.toLowerCase()];
  if (!action) return false;
  action();
  event.preventDefault();
  return true;
};
