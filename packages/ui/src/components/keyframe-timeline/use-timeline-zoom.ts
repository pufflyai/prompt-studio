import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { keyframeTimelineMetrics as metrics } from "../../theme/primitives/keyframe-timeline";

export const useTimelineZoom = (ruler: RefObject<HTMLDivElement | null>, duration: number) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(Math.max(metrics.minimumWidth, duration * metrics.pixelsPerSecond));
  const anchor = useRef<{ fraction: number; x: number; width: number } | null>(null);

  useEffect(() => {
    const node = ruler.current;
    const viewport = viewportRef.current;
    if (!node || !viewport) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.defaultPrevented) return;
      // Trackpad pinch is a Ctrl-wheel gesture. Own it before browser or Canvas zoom handles it.
      event.preventDefault();
      event.stopPropagation();
      const bounds = node.getBoundingClientRect();
      if (!bounds.width || !node.clientWidth) return;
      const unit = [1, 16, viewport.clientHeight][event.deltaMode] ?? 1;
      const minimum = Math.max(2 * metrics.inset + 1, viewport.clientWidth - metrics.labelWidth);
      const maximum = Math.max(minimum, metrics.minimumWidth, duration * metrics.pixelsPerSecond) * 64;
      const factor = Math.exp((-event.deltaY * unit) / 333);
      const current = anchor.current?.width ?? node.clientWidth + 2 * metrics.inset;
      const next = Math.max(minimum, Math.min(maximum, Math.max(current, minimum) * factor));
      if (next === current) return;
      anchor.current = { fraction: (event.clientX - bounds.left) / bounds.width, x: event.clientX, width: next };
      setWidth(next);
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [ruler, duration]);

  useLayoutEffect(() => {
    const point = anchor.current;
    const node = ruler.current;
    const viewport = viewportRef.current;
    // Only correct the width commit scheduled by this gesture, never an unrelated playback render.
    if (!point || point.width !== width) return;
    anchor.current = null;
    if (!node || !viewport || !node.clientWidth) return;
    const bounds = node.getBoundingClientRect();
    const scale = bounds.width / node.clientWidth;
    if (scale) viewport.scrollLeft += (bounds.left + point.fraction * bounds.width - point.x) / scale;
  }, [width, ruler]);

  return { width, viewportRef };
};
