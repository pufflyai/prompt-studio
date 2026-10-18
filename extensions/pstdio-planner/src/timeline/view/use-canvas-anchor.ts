import { type RefObject, useEffectEvent, useLayoutEffect, useRef } from "react";

interface CanvasAnchor {
  card?: HTMLElement;
  top: number;
  scrollTop: number;
  bottom: boolean;
}

// Newly mounted cards replace estimated heights. Keep the same visible point while geometry settles.
export function useCanvasAnchor(ref: RefObject<HTMLDivElement | null>) {
  const pending = useRef<CanvasAnchor | undefined>(undefined);
  const capture = useEffectEvent(() => {
    const viewport = ref.current;
    if (!viewport || pending.current) return;
    const bounds = viewport.getBoundingClientRect();
    const card = [...viewport.querySelectorAll<HTMLElement>("[data-ticket]")].find((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.bottom > bounds.top && rect.top < bounds.bottom && rect.right > bounds.left && rect.left < bounds.right
      );
    });
    pending.current = {
      card,
      top: card?.getBoundingClientRect().top ?? 0,
      scrollTop: viewport.scrollTop,
      bottom: viewport.scrollTop > 0 && viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 1,
    };
  });
  useLayoutEffect(() => {
    const anchor = pending.current;
    const viewport = ref.current;
    pending.current = undefined;
    if (!anchor || !viewport) return;
    if (anchor.bottom) {
      viewport.scrollTop = viewport.scrollHeight;
    } else if (anchor.card?.isConnected) {
      const shift = anchor.card.getBoundingClientRect().top - anchor.top + viewport.scrollTop - anchor.scrollTop;
      viewport.scrollTop += shift;
    }
  });
  return capture;
}
