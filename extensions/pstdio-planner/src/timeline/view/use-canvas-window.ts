import { type RefObject, useEffect, useState } from "react";

// Scroll updates belong to the canvas contents, so panning never reruns graph layout.
export function useCanvasWindow(ref: RefObject<HTMLDivElement | null>) {
  const [window, setWindow] = useState({ left: 0, top: 0, focusedId: undefined as string | undefined });
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const focused = viewport.ownerDocument.activeElement;
        const focusedId =
          focused instanceof HTMLElement ? focused.closest<HTMLElement>("[data-ticket]")?.dataset.ticket : undefined;
        const next = { left: viewport.scrollLeft, top: viewport.scrollTop, focusedId };
        setWindow((current) =>
          current.left === next.left && current.top === next.top && current.focusedId === focusedId ? current : next,
        );
      });
    };
    update();
    viewport.addEventListener("scroll", update, { passive: true });
    viewport.addEventListener("focusin", update);
    viewport.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", update);
      viewport.removeEventListener("focusin", update);
      viewport.removeEventListener("focusout", update);
    };
  }, [ref]);
  return window;
}
