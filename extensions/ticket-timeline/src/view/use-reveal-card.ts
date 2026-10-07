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
  useEffect(() => {
    const viewport = ref.current;
    const position = selectedId ? box.positions.get(selectedId) : undefined;
    if (!viewport || !position) {
      return;
    }

    const left = Math.min(viewport.scrollLeft, (position.x - gutterWidth - padding) * zoom);
    const top = Math.min(viewport.scrollTop, (position.y - headerHeight - padding) * zoom);
    viewport.scrollTo({
      left: Math.max(left, (position.x + position.width + padding) * zoom - viewport.clientWidth),
      top: Math.max(top, (position.y + position.height + trackHeaderHeight + padding) * zoom - viewport.clientHeight),
      behavior: "smooth",
    });
  }, [selectedId, box, zoom, ref]);
}
