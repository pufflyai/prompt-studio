import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

const BOTTOM_PANEL_DEFAULT_HEIGHT_PX = 240;
const BOTTOM_PANEL_MIN_HEIGHT_PX = 128;
const BOTTOM_PANEL_MAX_HEIGHT_PX = 420;
const BOTTOM_PANEL_MAIN_MIN_HEIGHT_PX = 240;
const BOTTOM_PANEL_KEYBOARD_STEP_PX = 24;
const BOTTOM_PANEL_COLLAPSE_THRESHOLD_PX = 72;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveMaxHeight = (root: HTMLDivElement | null) => {
  const rootHeight = root?.getBoundingClientRect().height ?? 0;
  if (rootHeight <= 0) return BOTTOM_PANEL_MAX_HEIGHT_PX;

  return Math.max(
    BOTTOM_PANEL_MIN_HEIGHT_PX,
    Math.min(BOTTOM_PANEL_MAX_HEIGHT_PX, rootHeight - BOTTOM_PANEL_MAIN_MIN_HEIGHT_PX),
  );
};

interface BottomPanelResizeInput {
  bodyNode: HTMLDivElement | null;
  onCollapsedChange: (collapsed: boolean) => void;
}

export const bottomPanelResizeBounds = {
  minPx: BOTTOM_PANEL_MIN_HEIGHT_PX,
  defaultPx: BOTTOM_PANEL_DEFAULT_HEIGHT_PX,
};

export const useBottomPanelResize = (input: BottomPanelResizeInput) => {
  const { bodyNode, onCollapsedChange } = input;
  const cleanupRef = useRef<() => void>(() => undefined);
  const [height, setHeight] = useState(BOTTOM_PANEL_DEFAULT_HEIGHT_PX);

  useEffect(() => () => cleanupRef.current(), []);

  const resize = (next: number) => {
    onCollapsedChange(false);
    setHeight(clamp(next, BOTTOM_PANEL_MIN_HEIGHT_PX, resolveMaxHeight(bodyNode)));
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
      nextCollapsed = rawHeight <= BOTTOM_PANEL_COLLAPSE_THRESHOLD_PX;
      nextHeight = nextCollapsed
        ? BOTTOM_PANEL_MIN_HEIGHT_PX
        : clamp(rawHeight, BOTTOM_PANEL_MIN_HEIGHT_PX, resolveMaxHeight(bodyNode));
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
      onCollapsedChange(true);
    } else if (event.key === "End") {
      event.preventDefault();
      resize(resolveMaxHeight(bodyNode));
    }
  };

  return {
    height,
    maxHeight: resolveMaxHeight(bodyNode),
    onPointerDown,
    onKeyDown,
  };
};
