import { type RefObject, useLayoutEffect, useRef } from "react";
import type { PlanViewProps } from "./plan-view";

const viewportAnchor = (viewport: HTMLDivElement) => {
  const top = viewport.getBoundingClientRect().top;
  const cards = [...viewport.querySelectorAll<HTMLElement>("[data-ticket]")];
  const card = cards.find((card) => card.getBoundingClientRect().bottom >= top);
  return card ? { id: card.dataset.ticket!, top: card.getBoundingClientRect().top - top } : undefined;
};

export function usePlanPaging(ref: RefObject<HTMLDivElement | null>, key: string, paging: PlanViewProps["paging"]) {
  const anchor = useRef<{ id: string; top: number } | undefined>(undefined);
  const restoring = useRef(false);
  const restoredPage = useRef<string | undefined>(undefined);
  const capture = () => {
    const viewport = ref.current;
    if (!viewport) return;
    anchor.current = viewportAnchor(viewport);
  };
  useLayoutEffect(() => {
    const viewport = ref.current;
    if (!viewport || restoredPage.current === key) return;
    restoredPage.current = key;
    const saved = anchor.current;
    if (saved) {
      const card = [...viewport.querySelectorAll<HTMLElement>("[data-ticket]")].find(
        (card) => card.dataset.ticket === saved.id,
      );
      if (card) {
        restoring.current = true;
        viewport.scrollTop += card.getBoundingClientRect().top - viewport.getBoundingClientRect().top - saved.top;
        requestAnimationFrame(() => {
          restoring.current = false;
          anchor.current = viewportAnchor(viewport);
        });
      }
    }
    anchor.current = viewportAnchor(viewport);
  }, [key, ref]);
  const advance = () => {
    const viewport = ref.current;
    if (!viewport || !paging || paging.loading || restoring.current) return;
    capture();
    if (
      viewport.scrollTop > 0 &&
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < viewport.clientHeight
    )
      paging.move("next");
    else if (paging.offset > 0 && viewport.scrollTop < viewport.clientHeight) paging.move("previous");
  };
  return { capture, advance };
}
