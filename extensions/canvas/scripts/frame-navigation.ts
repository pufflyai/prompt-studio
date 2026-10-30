import type { FrameMessage } from "../src/frames/protocol";

export const installFrameNavigation = (send: (message: Omit<FrameMessage, "protocol" | "nonce">) => void) => {
  const scrolls = (target: EventTarget | null, x: number, y: number) => {
    let node = target instanceof Element ? target : null;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (
        /auto|scroll/.test(style.overflowY) &&
        ((y < 0 && node.scrollTop > 0) || (y > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1))
      )
        return true;
      if (
        /auto|scroll/.test(style.overflowX) &&
        ((x < 0 && node.scrollLeft > 0) || (x > 0 && node.scrollLeft + node.clientWidth < node.scrollWidth - 1))
      )
        return true;
      node = node.parentElement;
    }
    return false;
  };
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.defaultPrevented) return;
      const unit = [1, 16, window.innerHeight][event.deltaMode] ?? 1;
      const zoom = event.ctrlKey || event.metaKey;
      if (!zoom && scrolls(event.target, event.deltaX * unit, event.deltaY * unit)) return;
      event.preventDefault();
      send({
        type: "wheel",
        x: event.clientX,
        y: event.clientY,
        deltaX: event.deltaX * unit,
        deltaY: event.deltaY * unit,
        zoom,
      });
    },
    { passive: false },
  );
  let interacted = false;
  document.addEventListener(
    "pointerdown",
    () => {
      interacted = true;
    },
    true,
  );
  document.addEventListener(
    "keydown",
    () => {
      interacted = true;
    },
    true,
  );
  let space = false;
  let dragged = false;
  let pan: { id: number; x: number; y: number } | undefined;
  const control = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest('input,textarea,button,select,[contenteditable],a[href],[role="combobox"]');
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !control(event.target)) {
      space = true;
      event.preventDefault();
    }
  });
  document.addEventListener("keyup", (event) => {
    if (event.code === "Space") space = false;
  });
  window.addEventListener("blur", () => {
    space = false;
    pan = undefined;
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 1 && !(space && !control(document.activeElement))) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
      pan = { id: event.pointerId, x: event.screenX, y: event.screenY };
      (event.target as Element).setPointerCapture(event.pointerId);
    },
    true,
  );
  document.addEventListener(
    "pointermove",
    (event) => {
      if (pan?.id !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      dragged ||= Math.abs(event.screenX - pan.x) + Math.abs(event.screenY - pan.y) > 3;
      send({ type: "pan", deltaX: event.screenX - pan.x, deltaY: event.screenY - pan.y });
      pan = { ...pan, x: event.screenX, y: event.screenY };
    },
    true,
  );
  const end = () => {
    pan = undefined;
  };
  document.addEventListener("pointerup", end, true);
  document.addEventListener(
    "pointercancel",
    () => {
      end();
      dragged = false;
    },
    true,
  );
  const suppressDragClick = (event: MouseEvent) => {
    if (!dragged) return;
    dragged = false;
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener("click", suppressDragClick, true);
  document.addEventListener("auxclick", suppressDragClick, true);
  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!interacted || !(target instanceof HTMLElement)) return;
    requestAnimationFrame(() => {
      if (!target.isConnected || document.activeElement !== target) return;
      const rect = target.getBoundingClientRect();
      send({ type: "focus", x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    });
  });
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link) return;
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("#canvas-item=")) send({ type: "reveal", id: decodeURIComponent(href.slice(13)) });
    if (!href.startsWith("#") || href.startsWith("#canvas-item=")) event.preventDefault();
  });
};
