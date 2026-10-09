import { type RefObject, useEffect, useState } from "react";

// The canvas follows native card sizing, including wrapped titles and property rows.
export function useCardHeights(ref: RefObject<HTMLDivElement | null>, visibleIds: string) {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport) return;
    const visible = new Set(visibleIds.split(","));
    setHeights((current) => {
      if ([...current.keys()].every((id) => visible.has(id))) return current;
      return new Map([...current].filter(([id]) => visible.has(id)));
    });
    const cards = viewport.querySelectorAll<HTMLElement>("[data-ticket]");
    const observer = new ResizeObserver((entries) => {
      setHeights((current) => {
        const next = new Map(current);
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.ticket!;
          const height = Math.ceil(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height);
          next.set(id, height);
        }
        return entries.some((entry) => {
          const id = (entry.target as HTMLElement).dataset.ticket!;
          return current.get(id) !== next.get(id);
        })
          ? next
          : current;
      });
    });
    for (const card of cards) {
      if (visible.has(card.dataset.ticket!)) observer.observe(card);
    }
    return () => observer.disconnect();
  }, [ref, visibleIds]);
  return heights;
}
