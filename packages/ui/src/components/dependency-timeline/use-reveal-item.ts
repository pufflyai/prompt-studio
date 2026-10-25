// Bring a selected review card into view beyond scaled pinned dates, columns, and milestone headers.
import { type RefObject, useEffect, useEffectEvent } from "react";
import { type geometry, gutterWidth, headerHeight, padding, trackHeaderHeight } from "./timeline-geometry";

export function useRevealItem(props: {
  ref: RefObject<HTMLDivElement | null>;
  selectedId?: string;
  box: ReturnType<typeof geometry>;
  zoom: number;
}) {
  const { ref, selectedId, box, zoom } = props;
  const position = selectedId ? box.positions.get(selectedId) : undefined;
  const { x, y, width, height } = position ?? {};
  const currentZoom = useEffectEvent(() => zoom);
  useEffect(() => {
    const viewport = ref.current;
    if (!selectedId || !viewport || x === undefined || y === undefined || width === undefined || height === undefined) {
      return;
    }

    const scale = currentZoom();
    const left = Math.min(viewport.scrollLeft, (x - gutterWidth - padding) * scale);
    const top = Math.min(viewport.scrollTop, (y - headerHeight - padding) * scale);
    viewport.scrollTo({
      left: Math.max(left, (x + width + padding) * scale - viewport.clientWidth),
      top: Math.max(top, (y + height + trackHeaderHeight + padding) * scale - viewport.clientHeight),
      behavior: "smooth",
    });
  }, [selectedId, x, y, width, height, ref]);
}
