import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { WorkbenchAreaSize } from "../../core";

const BOTTOM_PANEL_DEFAULT_HEIGHT_PX = 240;
const BOTTOM_PANEL_MIN_HEIGHT_PX = 128;
const BOTTOM_PANEL_MAX_HEIGHT_PX = 420;
const BOTTOM_PANEL_MAIN_MIN_HEIGHT_PX = 240;
const BOTTOM_PANEL_KEYBOARD_STEP_PX = 24;
const BOTTOM_PANEL_COLLAPSE_THRESHOLD_PX = 72;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveBottomPanelSize = (areaSize: WorkbenchAreaSize | undefined): Required<WorkbenchAreaSize> => ({
  defaultPx: areaSize?.defaultPx ?? BOTTOM_PANEL_DEFAULT_HEIGHT_PX,
  minPx: areaSize?.minPx ?? BOTTOM_PANEL_MIN_HEIGHT_PX,
  maxPx: areaSize?.maxPx ?? BOTTOM_PANEL_MAX_HEIGHT_PX,
});

const resolveMaxHeight = (root: HTMLDivElement | null, size: Required<WorkbenchAreaSize>) => {
  const rootHeight = root?.getBoundingClientRect().height ?? 0;
  if (rootHeight <= 0) return size.maxPx;

  return Math.max(size.minPx, Math.min(size.maxPx, rootHeight - BOTTOM_PANEL_MAIN_MIN_HEIGHT_PX));
};

interface BottomPanelResizeInput {
  bodyNode: HTMLDivElement | null;
  areaSize?: WorkbenchAreaSize;
  collapsible?: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onSizeChange?: (height: number) => void;
}

export const useBottomPanelResize = (input: BottomPanelResizeInput) => {
  const { areaSize, bodyNode, collapsible = true, onCollapsedChange, onSizeChange } = input;
  const size = resolveBottomPanelSize(areaSize);
  const defaultHeight = clamp(size.defaultPx, size.minPx, size.maxPx);
  const maxHeight = resolveMaxHeight(bodyNode, size);
  const cleanupRef = useRef<() => void>(() => undefined);
  const [height, setHeight] = useState(defaultHeight);

  useEffect(() => () => cleanupRef.current(), []);

  useEffect(() => {
    setHeight(defaultHeight);
  }, [defaultHeight]);

  useEffect(() => {
    setHeight((current) => clamp(current, size.minPx, maxHeight));
  }, [maxHeight, size.minPx]);

  const resize = (next: number) => {
    onCollapsedChange(false);
    const nextHeight = clamp(next, size.minPx, maxHeight);
    setHeight(nextHeight);
    onSizeChange?.(nextHeight);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    cleanupRef.current();

    const resizeHandle = event.currentTarget;
    const startY = event.clientY;
    const startHeight = height;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let nextHeight = startHeight;
    let nextCollapsed = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rawHeight = startHeight - (moveEvent.clientY - startY);
      nextCollapsed = collapsible && rawHeight <= BOTTOM_PANEL_COLLAPSE_THRESHOLD_PX;
      nextHeight = nextCollapsed ? size.minPx : clamp(rawHeight, size.minPx, resolveMaxHeight(bodyNode, size));
      setHeight(nextHeight);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
      cleanupRef.current = () => undefined;
      if (nextCollapsed) onCollapsedChange(true);
      else resize(nextHeight);
    };

    cleanupRef.current = cleanup;
    resizeHandle.setPointerCapture(event.pointerId);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup, { once: true });
    window.addEventListener("pointercancel", cleanup, { once: true });
    window.addEventListener("blur", cleanup, { once: true });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      resize(height + BOTTOM_PANEL_KEYBOARD_STEP_PX);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      resize(height - BOTTOM_PANEL_KEYBOARD_STEP_PX);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (collapsible) onCollapsedChange(true);
      else resize(size.minPx);
    } else if (event.key === "End") {
      event.preventDefault();
      resize(maxHeight);
    }
  };

  return {
    height,
    maxHeight,
    minHeight: size.minPx,
    onPointerDown,
    onKeyDown,
  };
};
