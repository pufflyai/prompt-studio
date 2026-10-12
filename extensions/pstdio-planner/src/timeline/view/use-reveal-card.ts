// Bring a selected review card into view beyond scaled pinned dates, columns, and milestone headers.
import { type RefObject, useEffect } from "react";
import { type geometry, gutterWidth, headerHeight, padding, trackHeaderHeight } from "./graph-geometry";

export function useRevealCard(props: {
  ref: RefObject<HTMLDivElement | null>;
  selectedId?: string;
  box: ReturnType<typeof geometry>;
  zoom: number;
}) {
  const { ref, selectedId, box, zoom } = props;
  const position = selectedId ? box.positions.get(selectedId) : undefined;
  const { x, y, width, height } = position ?? {};
  useEffect(() => {
    const viewport = ref.current;
    if (!selectedId || !viewport || x === undefined || y === undefined || width === undefined || height === undefined) {
      return;
    }

    const left = Math.min(viewport.scrollLeft, (x - gutterWidth - padding) * zoom);
    const top = Math.min(viewport.scrollTop, (y - headerHeight - padding) * zoom);
    viewport.scrollTo({
      left: Math.max(left, (x + width + padding) * zoom - viewport.clientWidth),
      top: Math.max(top, (y + height + trackHeaderHeight + padding) * zoom - viewport.clientHeight),
      behavior: "smooth",
    });
  }, [selectedId, x, y, width, height, zoom, ref]);
}
