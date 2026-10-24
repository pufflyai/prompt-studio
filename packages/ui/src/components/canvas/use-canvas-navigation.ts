import { type RefObject, useLayoutEffect, useRef } from "react";
import type { CanvasProps, CanvasZoomChange } from "./canvas.types";
import { clampCanvasZoom, constrainCanvasZoom, defaultCanvasZoomLimits } from "./canvas-geometry";

export const useCanvasNavigation = (props: CanvasProps, viewport: RefObject<HTMLDivElement | null>) => {
  const { zoom, minZoom = defaultCanvasZoomLimits.minZoom, maxZoom = defaultCanvasZoomLimits.maxZoom } = props;
  const current = useRef(zoom);
  const latest = useRef(props);
  const limits = { minZoom, maxZoom };
  const requestZoom = (change: CanvasZoomChange) => {
    const next = constrainCanvasZoom(current.current, change, limits);
    if (!next) return;
    // Wheel and touch events can arrive before the controlled value commits.
    current.current = next.zoom;
    latest.current.onZoom(next.change);
  };
  const zoomTo = (value: number) => {
    requestZoom({
      factor: value / current.current,
      anchor: { x: viewport.current!.clientWidth / 2, y: viewport.current!.clientHeight / 2 },
    });
    latest.current.onNavigationEnd?.();
  };
  const navigation = useRef({ ...props, onZoom: requestZoom });
  useLayoutEffect(() => {
    latest.current = props;
    navigation.current = { ...props, onZoom: requestZoom };
  });
  useLayoutEffect(() => {
    current.current = zoom;
    const bounded = clampCanvasZoom(zoom, { minZoom, maxZoom });
    if (bounded === zoom) return;
    const next = constrainCanvasZoom(
      zoom,
      {
        factor: bounded / zoom,
        anchor: { x: viewport.current!.clientWidth / 2, y: viewport.current!.clientHeight / 2 },
      },
      { minZoom, maxZoom },
    )!;
    current.current = next.zoom;
    latest.current.onZoom(next.change);
    latest.current.onNavigationEnd?.();
  }, [zoom, minZoom, maxZoom, viewport]);
  return {
    navigation,
    zoomTo,
    zoomBy: (delta: number) => zoomTo(current.current + delta),
    resetZoom: clampCanvasZoom(1, limits),
  };
};
