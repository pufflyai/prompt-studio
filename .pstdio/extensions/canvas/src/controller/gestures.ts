import { navigateWithKeyboard } from "./keyboard";
import type { CanvasRuntime } from "./runtime";
import { canScroll, interactive } from "./scroll";
import { installTouch } from "./touch";

type CanvasEventMap = HTMLElementEventMap & DocumentEventMap & WindowEventMap;

export const installGestures = (shell: HTMLElement, runtime: CanvasRuntime) => {
  let space = false;
  let gesture: { pointer: number; x: number; y: number; item?: string; moved: boolean } | undefined;
  let suppressClick = 0;
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof CanvasEventMap>(
    element: HTMLElement | Document | Window,
    name: K,
    listener: (event: CanvasEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => {
    element.addEventListener(name, listener as EventListener, options);
    cleanups.push(() => element.removeEventListener(name, listener as EventListener, options));
  };
  const local = (event: { clientX: number; clientY: number }) => {
    const rect = shell.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const finish = () => {
    if (gesture) {
      if (gesture.moved) suppressClick = performance.now() + 500;
      const pointer = gesture.pointer;
      gesture = undefined;
      if (shell.hasPointerCapture(pointer)) shell.releasePointerCapture(pointer);
      runtime.flush();
    }
  };
  on(
    shell,
    "pointerdown",
    (event) => {
      if (gesture || (event.button !== 0 && event.button !== 1)) return;
      suppressClick = 0;
      const target = event.target instanceof Element ? event.target : null;
      const explicit = event.button === 1 || (space && !interactive(document.activeElement));
      const handle = target?.closest<HTMLElement>("[data-canvas-handle]");
      const empty = target === shell || target?.hasAttribute("data-canvas-empty");
      if (!explicit && !handle && !empty) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (handle && !explicit) handle.focus({ preventScroll: true });
      else shell.focus({ preventScroll: true });
      gesture = {
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        item: explicit ? undefined : handle?.dataset.canvasHandle,
        moved: false,
      };
      shell.setPointerCapture(event.pointerId);
    },
    { capture: true },
  );
  on(
    shell,
    "pointermove",
    (event) => {
      if (!gesture || event.pointerId !== gesture.pointer) return;
      const x = event.clientX - gesture.x;
      const y = event.clientY - gesture.y;
      if (!x && !y) return;
      gesture.moved = true;
      if (gesture.item)
        runtime.move(gesture.item, { x: x / runtime.get().camera.zoom, y: y / runtime.get().camera.zoom });
      else runtime.pan({ x, y });
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true },
  );
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const)
    on(
      shell,
      name,
      (event) => {
        if (gesture?.pointer === event.pointerId) {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish();
        }
      },
      { capture: true },
    );
  for (const name of ["click", "auxclick"] as const)
    on(
      shell,
      name,
      (event) => {
        if (performance.now() < suppressClick || event.button === 1) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true },
    );
  on(
    shell,
    "wheel",
    (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        runtime.zoom(Math.exp(-event.deltaY * 0.005), local(event));
        return;
      }
      let multiplier = event.deltaMode === 1 ? 16 : 1;
      if (event.deltaMode === 2) multiplier = shell.clientHeight;
      const x = event.deltaX * multiplier;
      const y = event.deltaY * multiplier;
      if (!canScroll(event.target, shell, x, y)) {
        event.preventDefault();
        runtime.pan({ x: -x, y: -y });
      }
    },
    { passive: false },
  );
  on(shell, "keydown", (event) => {
    if (event.code === "Space" && !interactive(event.target)) {
      space = true;
      event.preventDefault();
    }
    navigateWithKeyboard(event, shell, runtime);
  });
  on(window, "keyup", (event) => {
    if (event.code === "Space") space = false;
  });
  const cancel = () => {
    space = false;
    finish();
  };
  on(window, "blur", cancel);
  on(document, "visibilitychange", () => {
    if (document.hidden) cancel();
  });
  on(shell, "focusin", (event) => {
    if (event.target instanceof HTMLElement) runtime.revealFocus(event.target);
  });
  on(shell, "scroll", () => {
    shell.scrollLeft = 0;
    shell.scrollTop = 0;
  });
  cleanups.push(installTouch(shell, runtime, finish));
  const previous = [document.documentElement, document.body].map((element) => ({
    element,
    value: element.style.overscrollBehaviorX,
  }));
  for (const { element } of previous) element.style.overscrollBehaviorX = "none";
  return () => {
    cancel();
    for (const cleanup of cleanups) cleanup();
    for (const { element, value } of previous) element.style.overscrollBehaviorX = value;
  };
};
