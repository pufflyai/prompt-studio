import type { CanvasNavigation } from "./canvas.types";
import { preventCanvasOverscroll } from "./canvas-document";
import { navigateCanvasKey } from "./canvas-keyboard";
import { canScrollCanvasChild, isCanvasControl } from "./canvas-targets";
import { installCanvasTouch } from "./canvas-touch";

type PointerInput = Pick<
  PointerEvent,
  "pointerId" | "target" | "button" | "clientX" | "clientY" | "preventDefault" | "stopPropagation"
>;
type ClickInput = Pick<MouseEvent, "target" | "detail" | "button" | "preventDefault" | "stopPropagation">;

export const createCanvasInteractions = (viewport: HTMLElement, navigation: () => CanvasNavigation) => {
  const document = viewport.ownerDocument;
  const window = document.defaultView!;
  let space = false;
  let pointer: { id: number; x: number; y: number } | undefined;
  let moved = false;
  let suppressClick = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const inside = (target: EventTarget | null) => target instanceof Node && viewport.contains(target);
  const markMoved = () => {
    if (moved) return;
    moved = true;
    viewport.setAttribute("data-panning", "");
  };
  const finish = () => {
    viewport.removeAttribute("data-panning");
    if (moved) suppressClick = performance.now() + 500;
    moved = false;
    clearTimeout(timer);
    timer = undefined;
    navigation().onNavigationEnd?.();
  };
  const finishPointer = () => {
    if (!pointer) return;
    const id = pointer.id;
    pointer = undefined;
    if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
    finish();
  };
  const endAfterIdle = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      navigation().onNavigationEnd?.();
    }, 150);
  };
  const touch = installCanvasTouch({
    viewport,
    navigation,
    hasPointer: () => pointer !== undefined,
    finishPointer,
    markMoved,
    finish,
  });
  const cancel = () => {
    space = false;
    finishPointer();
    touch.cancel();
  };
  const visibility = () => {
    if (document.hidden) cancel();
  };
  const keyup = (event: KeyboardEvent) => {
    if (event.code === "Space") space = false;
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Space" && !isCanvasControl(event.target)) {
      space = true;
      event.preventDefault();
    }
    if (navigateCanvasKey(event, viewport, navigation())) endAfterIdle();
  };
  const wheel = (event: WheelEvent) => {
    const unit = [1, 16, viewport.clientHeight][event.deltaMode] ?? 1;
    const x = event.deltaX * unit;
    const y = event.deltaY * unit;
    if (event.ctrlKey || event.metaKey) {
      const rect = viewport.getBoundingClientRect();
      navigation().onZoom({
        factor: Math.exp(-y / 1000),
        anchor: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      });
    } else {
      if (canScrollCanvasChild(event.target, viewport, x, y)) return;
      navigation().onPan({ x: -x, y: -y });
    }
    event.preventDefault();
    endAfterIdle();
  };
  viewport.addEventListener("wheel", wheel, { passive: false });
  viewport.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", visibility);
  const restoreOverscroll = preventCanvasOverscroll(document);
  return {
    pointerDown: (event: PointerInput) => {
      if (pointer || !inside(event.target) || (event.button !== 0 && event.button !== 1)) return;
      suppressClick = 0;
      const explicit = event.button === 1 || (space && !isCanvasControl(document.activeElement));
      if (!explicit && isCanvasControl(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      viewport.focus({ preventScroll: true, focusVisible: false });
      viewport.setPointerCapture(event.pointerId);
    },
    pointerMove: (event: PointerInput) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const delta = { x: event.clientX - pointer.x, y: event.clientY - pointer.y };
      if (!moved && Math.hypot(delta.x, delta.y) < 4) return;
      markMoved();
      navigation().onPan(delta);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      event.preventDefault();
      event.stopPropagation();
    },
    pointerEnd: (event: PointerInput) => {
      if (pointer?.id !== event.pointerId) return;
      finishPointer();
      event.preventDefault();
      event.stopPropagation();
    },
    pointerLost: (event: PointerInput) => {
      if (event.target === viewport && pointer?.id === event.pointerId) finishPointer();
    },
    click: (event: ClickInput) => {
      if (!inside(event.target)) return;
      if (event.button === 1 || (event.detail > 0 && performance.now() < suppressClick)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    dispose: () => {
      cancel();
      touch.dispose();
      if (timer) {
        clearTimeout(timer);
        navigation().onNavigationEnd?.();
      }
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
      restoreOverscroll();
    },
  };
};
