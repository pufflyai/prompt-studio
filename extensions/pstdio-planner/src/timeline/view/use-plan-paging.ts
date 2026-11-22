import { type RefObject, useLayoutEffect, useRef } from "react";
import { type geometry, trackHeaderHeight } from "./graph-geometry";
import type { PlanViewProps } from "./plan-view";

const viewportAnchor = (
  viewport: HTMLDivElement,
  positions: ReturnType<typeof geometry>["positions"],
  zoom: number,
) => {
  const bounds = viewport.getBoundingClientRect();
  const cards = [...viewport.querySelectorAll<HTMLElement>("[data-ticket]")];
  const card = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return rect.bottom > bounds.top && rect.top < bounds.bottom && rect.right > bounds.left && rect.left < bounds.right;
  });
  if (card) {
    const rect = card.getBoundingClientRect();
    return { id: card.dataset.ticket!, left: rect.left - bounds.left, top: rect.top - bounds.top };
  }
  // A large pan can outrun the virtualized DOM. The current bounded layout still contains its visible anchor.
  for (const [id, position] of positions) {
    const left = position.x * zoom - viewport.scrollLeft;
    const top = (position.y + trackHeaderHeight) * zoom - viewport.scrollTop;
    if (
      left < viewport.clientWidth &&
      left + position.width * zoom > 0 &&
      top < viewport.clientHeight &&
      top + position.height * zoom > 0
    ) {
      return { id, left, top };
    }
  }
  return undefined;
};

export function usePlanPaging(
  ref: RefObject<HTMLDivElement | null>,
  key: string,
  paging: PlanViewProps["paging"],
  positions: ReturnType<typeof geometry>["positions"],
  zoom: number,
) {
  const anchor = useRef<ReturnType<typeof viewportAnchor>>(undefined);
  const restoring = useRef(false);
  const restoredPage = useRef<string | undefined>(undefined);
  const frame = useRef(0);
  const capture = () => {
    const viewport = ref.current;
    if (!viewport || restoring.current) return;
    anchor.current = viewportAnchor(viewport, positions, zoom);
  };
  useLayoutEffect(() => {
    const viewport = ref.current;
    if (!viewport || restoredPage.current === key) return;
    cancelAnimationFrame(frame.current);
    restoring.current = false;
    restoredPage.current = key;
    const saved = anchor.current;
    const position = saved && positions.get(saved.id);
    if (saved && position) {
      restoring.current = true;
      // Virtualization still sees the old scroll position during this commit, so the card may have no DOM node.
      viewport.scrollTo({
        left: position.x * zoom - saved.left,
        top: (position.y + trackHeaderHeight) * zoom - saved.top,
      });
      frame.current = requestAnimationFrame(() => {
        restoring.current = false;
        anchor.current = viewportAnchor(viewport, positions, zoom);
      });
    }
  }, [key, positions, ref, zoom]);
  useLayoutEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      restoring.current = false;
    },
    [],
  );
  const advance = (motion: { x: number; y: number } | undefined) => {
    const viewport = ref.current;
    if (!viewport || !paging || paging.loading || restoring.current || !motion) return;
    capture();
    const horizontal = Math.abs(motion.x) > Math.abs(motion.y);
    const delta = horizontal ? motion.x : motion.y;
    const { offset, size, extent, otherScrolls } = horizontal
      ? {
          offset: viewport.scrollLeft,
          size: viewport.clientWidth,
          extent: viewport.scrollWidth,
          otherScrolls: viewport.scrollHeight > viewport.clientHeight,
        }
      : {
          offset: viewport.scrollTop,
          size: viewport.clientHeight,
          extent: viewport.scrollHeight,
          otherScrolls: viewport.scrollWidth > viewport.clientWidth,
        };
    if (delta === 0 || (extent <= size && otherScrolls)) return;
    if (delta > 0 && extent - offset - size < size) paging.move("next");
    else if (delta < 0 && paging.offset > 0 && offset < size) paging.move("previous");
  };
  return { capture, advance };
}
