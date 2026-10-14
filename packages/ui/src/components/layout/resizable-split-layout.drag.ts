import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { flushSync } from "react-dom";
import {
  FALLBACK_ROOT_SIZE,
  type getResizableSplitAxis,
  type ResizableSplitSide,
  resolveDraggedPanelSize,
  resolveResizableBounds,
} from "./resizable-split-layout.geometry";

interface ResizeStartHandlerInput {
  axis: ReturnType<typeof getResizableSplitAxis>;
  resizableSide: ResizableSplitSide;
  collapsed: boolean;
  collapsible: boolean;
  resolvedPanelSize: number;
  minSizePx: number;
  maxSizePx?: number;
  contentMinSizePx: number;
  rootRef: RefObject<HTMLDivElement | null>;
  resizablePanelRef: RefObject<HTMLDivElement | null>;
  contentPanelRef: RefObject<HTMLDivElement | null>;
  separatorRef: RefObject<HTMLDivElement | null>;
  cleanupDragRef: RefObject<() => void>;
  lastSizeRef: RefObject<number>;
  applyPanelSize(size: number): void;
  commitPanelSize(size: number): void;
  setCollapsed(collapsed: boolean): void;
  setDragging(dragging: boolean): void;
  setClosing(closing: boolean): void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const getElementSize = (element: HTMLDivElement | null, dimension: "width" | "height") =>
  element?.getBoundingClientRect()[dimension] ?? 0;

export const createResizeStartHandler = (input: ResizeStartHandlerInput) => {
  const {
    axis,
    resizableSide,
    collapsed,
    collapsible,
    resolvedPanelSize,
    minSizePx,
    maxSizePx,
    contentMinSizePx,
    rootRef,
    resizablePanelRef,
    contentPanelRef,
    separatorRef,
    cleanupDragRef,
    lastSizeRef,
    applyPanelSize,
    commitPanelSize,
    setCollapsed,
    setDragging,
    setClosing,
  } = input;
  return (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (collapsed && !collapsible)) return;

    event.preventDefault();
    cleanupDragRef.current();

    const resizeHandle = event.currentTarget;
    const bounds = resolveResizableBounds({
      rootSize: getElementSize(rootRef.current, axis.dimension),
      fallbackRootSize: FALLBACK_ROOT_SIZE[axis.dimension],
      minSize: minSizePx,
      maxSize: maxSizePx,
      contentMinSize: contentMinSizePx,
      separatorSize: getElementSize(separatorRef.current, axis.dimension),
    });
    const startPointer = event[axis.pointerCoordinate];
    const startSize = collapsed ? 0 : getElementSize(resizablePanelRef.current, axis.dimension) || lastSizeRef.current;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let nextSize = startSize === 0 ? 0 : clamp(startSize, bounds.minSize, bounds.maxSize);
    let nextCollapsed = collapsed;
    let animationFrame = 0;
    let moved = false;

    const setDraggingPanelState = (value: string) => {
      if (resizablePanelRef.current) resizablePanelRef.current.style.pointerEvents = value;
      if (contentPanelRef.current) contentPanelRef.current.style.pointerEvents = value;
    };

    const schedulePanelSize = () => {
      if (animationFrame) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        applyPanelSize(nextSize);
      });
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moved ||= moveEvent[axis.pointerCoordinate] !== startPointer;
      const result = resolveDraggedPanelSize({
        side: resizableSide,
        startSize,
        pointerDelta: moveEvent[axis.pointerCoordinate] - startPointer,
        minSize: bounds.minSize,
        maxSize: bounds.maxSize,
        collapsible,
      });
      nextCollapsed = result.collapsed;
      // Keep the panel visible at its minimum until release confirms the close.
      nextSize = clamp(result.rawSize, bounds.minSize, bounds.maxSize);
      setClosing(nextCollapsed && !collapsed);
      schedulePanelSize();
    };

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
      setDraggingPanelState("");
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      cleanupDragRef.current = () => undefined;
      setClosing(false);
      if (!commit || !moved) {
        // Resume opening without committing an intermediate size from a divider press.
        flushSync(() => setDragging(false));
        rootRef.current?.getBoundingClientRect();
        applyPanelSize(resolvedPanelSize);
        return;
      }
      if (nextCollapsed) {
        // Settle the final drag geometry before restoring programmatic transitions.
        applyPanelSize(0);
        flushSync(() => setCollapsed(true));
        resizablePanelRef.current?.getBoundingClientRect();
      } else {
        setCollapsed(false);
        commitPanelSize(nextSize);
      }
      setDragging(false);
    };

    const handlePointerUp = () => finish(true);
    const cancel = () => finish(false);
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      cancel();
    };

    cleanupDragRef.current = cancel;
    resizeHandle.setPointerCapture(event.pointerId);
    document.body.style.cursor = axis.cursor;
    document.body.style.userSelect = "none";
    setDraggingPanelState("none");
    // Disabling the transition must keep its current size and the saved target.
    rootRef.current?.style.setProperty("--split-size", `${startSize}px`);
    setDragging(true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    window.addEventListener("blur", cancel, { once: true });
    window.addEventListener("keydown", handleKeyDown);
  };
};
