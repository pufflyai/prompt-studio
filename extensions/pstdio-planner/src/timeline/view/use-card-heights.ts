import { type RefObject, useEffect, useEffectEvent, useState } from "react";
import { useCanvasAnchor } from "./use-canvas-anchor";

// The canvas follows native card sizing, including wrapped titles and property rows.
export function useCardHeights(ref: RefObject<HTMLDivElement | null>, visibleIds: string) {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
  const captureAnchor = useCanvasAnchor(ref);
  const measure = useEffectEvent((entries: ResizeObserverEntry[]) => {
    const measured = entries.map((entry) => ({
      id: (entry.target as HTMLElement).dataset.ticket!,
      height: Math.ceil(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height),
    }));
    if (!measured.some(({ id, height }) => heights.get(id) !== height)) return;
    captureAnchor();
    setHeights((current) => {
      const next = new Map(current);
      for (const { id, height } of measured) next.set(id, height);
      return next;
    });
  });
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport) return;
    const visible = new Set(visibleIds.split(","));
    setHeights((current) => {
      if ([...current.keys()].every((id) => visible.has(id))) return current;
      return new Map([...current].filter(([id]) => visible.has(id)));
    });
    const observer = new ResizeObserver(measure);
    const observed = new Set<HTMLElement>();
    const sync = () => {
      const cards = new Set(viewport.querySelectorAll<HTMLElement>("[data-ticket]"));
      for (const card of observed) {
        if (!cards.has(card)) {
          observer.unobserve(card);
          observed.delete(card);
        }
      }
      for (const card of cards) {
        if (visible.has(card.dataset.ticket!) && !observed.has(card)) {
          observer.observe(card);
          observed.add(card);
        }
      }
    };
    sync();
    const mutations = new MutationObserver(sync);
    mutations.observe(viewport, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [ref, visibleIds]);
  return heights;
}
