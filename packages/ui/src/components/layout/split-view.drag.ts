import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { SplitPane } from "./split-view";
import { applyPaneSizeToElement, type SplitDirection } from "./split-view.dom";
import { redistributePaneSizes, resolveCollapseThreshold, type SplitPaneGeometry } from "./split-view.geometry";

interface SplitViewDragContext {
  direction: SplitDirection;
  panes: SplitPane[];
  paneRefs: RefObject<Map<string, HTMLDivElement>>;
  cleanupDragRef: RefObject<() => void>;
  getControlledPane: (before: SplitPane, after: SplitPane) => SplitPane | undefined;
  getPairGeometry: (before: SplitPane, after: SplitPane) => { before: SplitPaneGeometry; after: SplitPaneGeometry };
  getAvailablePairSize: (before: SplitPane, after: SplitPane) => number;
  getResolvedPaneSize: (pane: SplitPane) => number;
  setPaneCollapsed: (pane: SplitPane, collapsed: boolean) => void;
  commitSizes: (sizes: Array<{ id: string; sizePx: number }>) => void;
}

export const createSplitViewResizeStart = (context: SplitViewDragContext) => {
  const {
    direction,
    panes,
    paneRefs,
    cleanupDragRef,
    getControlledPane,
    getPairGeometry,
    getAvailablePairSize,
    getResolvedPaneSize,
    setPaneCollapsed,
    commitSizes,
  } = context;

  return (handleIndex: number, event: ReactPointerEvent<HTMLDivElement>) => {
    const before = panes[handleIndex];
    const after = panes[handleIndex + 1];
    if (event.button !== 0 || !before || !after) return;
    const controlled = getControlledPane(before, after);
    if (!controlled) return;

    event.preventDefault();
    cleanupDragRef.current();
    const resizeHandle = event.currentTarget;
    const startCoordinate = direction === "row" ? event.clientX : event.clientY;
    const geometry = getPairGeometry(before, after);
    const pairSize = getAvailablePairSize(before, after);
    const controlledBefore = controlled.id === before.id;
    const controlledStartSize = getResolvedPaneSize(controlled);
    const collapseThreshold = resolveCollapseThreshold(controlled.minSizePx ?? 0);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let nextSizes = redistributePaneSizes({ rootSize: pairSize, deltaPx: 0, ...geometry });
    let nextCollapsed = false;
    let animationFrame = 0;

    const applyNextSizes = () => {
      for (const size of nextSizes) {
        applyPaneSizeToElement(paneRefs.current.get(size.id) ?? null, direction, size.sizePx);
      }
      if (nextCollapsed) applyPaneSizeToElement(paneRefs.current.get(controlled.id) ?? null, direction, 0);
    };

    const scheduleSizes = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        applyNextSizes();
      });
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const coordinate = direction === "row" ? moveEvent.clientX : moveEvent.clientY;
      const deltaPx = coordinate - startCoordinate;
      const controlledDelta = controlledBefore ? deltaPx : -deltaPx;
      nextCollapsed = controlled.collapsible !== false && controlledStartSize + controlledDelta <= collapseThreshold;
      nextSizes = redistributePaneSizes({ rootSize: pairSize, deltaPx, ...geometry });
      scheduleSizes();
    };

    const setPointerEvents = (value: string) => {
      for (const pane of paneRefs.current.values()) pane.style.pointerEvents = value;
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
      setPointerEvents("");
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      cleanupDragRef.current = () => undefined;
      applyNextSizes();
      if (nextCollapsed) setPaneCollapsed(controlled, true);
      else {
        setPaneCollapsed(controlled, false);
        commitSizes(nextSizes);
      }
    };

    cleanupDragRef.current = cleanup;
    resizeHandle.setPointerCapture(event.pointerId);
    document.body.style.cursor = direction === "row" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    setPointerEvents("none");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup, { once: true });
    window.addEventListener("pointercancel", cleanup, { once: true });
    window.addEventListener("blur", cleanup, { once: true });
  };
};
