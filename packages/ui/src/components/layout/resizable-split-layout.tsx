import { Flex, type FlexProps } from "@chakra-ui/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { type ResizableSplitSide, ResizeHandle } from "@/components/layout/resizable-split-layout.handle";

interface ResizableSplitLayoutProps extends Omit<FlexProps, "children" | "onResize"> {
  resizablePanel: ReactNode;
  contentPanel: ReactNode;
  resizableSide?: ResizableSplitSide;
  defaultSizePx?: number;
  minSizePx?: number;
  maxSizePx?: number;
  contentMinSizePx?: number;
  collapsed?: boolean;
  collapsible?: boolean;
  resizeLabel?: string;
  showResizeSeparator?: boolean;
  onSizeChange?: (width: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const FALLBACK_ROOT_WIDTH = 1200;
const KEYBOARD_RESIZE_STEP = 24;
const MIN_COLLAPSE_THRESHOLD_PX = 72;
const MAX_COLLAPSE_THRESHOLD_PX = 160;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveRootWidth = (rootWidth: number) => (rootWidth > 0 ? rootWidth : FALLBACK_ROOT_WIDTH);

const resolveCollapseThreshold = (minSizePx: number) =>
  clamp(minSizePx / 2, MIN_COLLAPSE_THRESHOLD_PX, MAX_COLLAPSE_THRESHOLD_PX);

const resolveResizableBoundsPx = (input: {
  rootWidth: number;
  minSizePx: number;
  maxSizePx?: number;
  contentMinSizePx: number;
}) => {
  const rootWidth = resolveRootWidth(input.rootWidth);
  const maxFromContent = Math.max(0, rootWidth - input.contentMinSizePx);
  const configuredMax = input.maxSizePx ?? maxFromContent;
  const maxSize = Math.max(0, Math.min(configuredMax, maxFromContent));
  const minSize = Math.min(input.minSizePx, maxSize);

  return { minSize, maxSize };
};

const getElementWidth = (element: HTMLDivElement | null) => element?.getBoundingClientRect().width ?? 0;

const applyPanelWidthToElement = (panel: HTMLDivElement | null, width: number) => {
  if (!panel) return;

  panel.style.width = `${width}px`;
  panel.style.flexBasis = `${width}px`;
  panel.style.flexGrow = "0";
  panel.style.flexShrink = "0";
  panel.style.display = width > 0 ? "flex" : "none";
};

const clearPanelInlineStyles = (panel: HTMLDivElement | null) => {
  if (!panel) return;

  panel.style.width = "";
  panel.style.flexBasis = "";
  panel.style.flexGrow = "";
  panel.style.flexShrink = "";
  panel.style.display = "";
};

export const ResizableSplitLayout = (props: ResizableSplitLayoutProps) => {
  const {
    resizablePanel,
    contentPanel,
    resizableSide = "left",
    defaultSizePx = 240,
    minSizePx = 200,
    maxSizePx,
    contentMinSizePx = 0,
    collapsed: controlledCollapsed,
    collapsible = true,
    resizeLabel = "Resize panel",
    showResizeSeparator = true,
    onSizeChange,
    onCollapsedChange,
    ...rest
  } = props;
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const resizablePanelRef = useRef<HTMLDivElement>(null);
  const contentPanelRef = useRef<HTMLDivElement>(null);
  const cleanupDragRef = useRef<() => void>(() => undefined);
  const lastWidthRef = useRef(defaultSizePx);
  const [panelWidth, setPanelWidth] = useState(defaultSizePx);
  const [rootWidth, setRootWidth] = useState(0);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const bounds = resolveResizableBoundsPx({ rootWidth, minSizePx, maxSizePx, contentMinSizePx });
  const collapseThresholdPx = resolveCollapseThreshold(minSizePx);
  const resolvedPanelWidth = collapsed ? 0 : clamp(panelWidth, bounds.minSize, bounds.maxSize);
  const contentPanelId = `${id}-content`;
  const resizablePanelId = `${id}-resizable`;

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const updateRootWidth = () => {
      setRootWidth(element.getBoundingClientRect().width);
    };

    updateRootWidth();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateRootWidth);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    lastWidthRef.current = defaultSizePx;
    setPanelWidth(defaultSizePx);
  }, [defaultSizePx]);

  useEffect(() => () => cleanupDragRef.current(), []);

  const applyPanelWidth = (width: number) => {
    applyPanelWidthToElement(resizablePanelRef.current, width);
  };

  useEffect(() => {
    // React may reuse the same DOM element across renders when this component swaps roles
    // (e.g., a wrapping ResizableSplitLayout disappears, leaving the inner one in its place).
    // Clear any inline styles on the content panel that leaked from a prior render where
    // the same DOM element was the resizable panel; otherwise stale `flex: 0 0 Xpx` pins
    // the content's width.
    clearPanelInlineStyles(contentPanelRef.current);
    applyPanelWidthToElement(resizablePanelRef.current, resolvedPanelWidth);
  }, [resolvedPanelWidth]);

  const commitPanelWidth = (width: number) => {
    const rootWidth = getElementWidth(rootRef.current);
    const nextBounds = resolveResizableBoundsPx({ rootWidth, minSizePx, maxSizePx, contentMinSizePx });
    const nextWidth = clamp(width, nextBounds.minSize, nextBounds.maxSize);

    lastWidthRef.current = nextWidth;
    setPanelWidth(nextWidth);
    applyPanelWidth(nextWidth);
    onSizeChange?.(nextWidth);
  };

  const setCollapsed = (nextCollapsed: boolean) => {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(nextCollapsed);
    }

    onCollapsedChange?.(nextCollapsed);
  };

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (collapsed && !collapsible)) return;

    event.preventDefault();
    cleanupDragRef.current();

    const resizeHandle = event.currentTarget;
    const rootWidth = getElementWidth(rootRef.current);
    const bounds = resolveResizableBoundsPx({ rootWidth, minSizePx, maxSizePx, contentMinSizePx });
    const startX = event.clientX;
    const startWidth = collapsed ? 0 : getElementWidth(resizablePanelRef.current) || lastWidthRef.current;
    const direction = resizableSide === "left" ? 1 : -1;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let nextWidth = startWidth === 0 ? 0 : clamp(startWidth, bounds.minSize, bounds.maxSize);
    let nextCollapsed = collapsed;
    let animationFrame = 0;

    const setDraggingPanelState = (value: string) => {
      if (resizablePanelRef.current) resizablePanelRef.current.style.pointerEvents = value;
      if (contentPanelRef.current) contentPanelRef.current.style.pointerEvents = value;
    };

    const schedulePanelWidth = () => {
      if (animationFrame) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        applyPanelWidth(nextWidth);
      });
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rawWidth = startWidth + (moveEvent.clientX - startX) * direction;
      nextCollapsed = collapsible && rawWidth <= collapseThresholdPx;
      nextWidth = nextCollapsed ? 0 : clamp(rawWidth, bounds.minSize, bounds.maxSize);
      if (!nextCollapsed) lastWidthRef.current = nextWidth;
      schedulePanelWidth();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
      setDraggingPanelState("");
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      cleanupDragRef.current = () => undefined;
      if (nextCollapsed) {
        applyPanelWidth(0);
        setCollapsed(true);
      } else {
        setCollapsed(false);
        commitPanelWidth(nextWidth);
      }
    };

    cleanupDragRef.current = cleanup;
    resizeHandle.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setDraggingPanelState("none");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup, { once: true });
    window.addEventListener("pointercancel", cleanup, { once: true });
    window.addEventListener("blur", cleanup, { once: true });
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction = resizableSide === "left" ? 1 : -1;
    const width = lastWidthRef.current;

    if (collapsed && (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "End")) {
      event.preventDefault();
      setCollapsed(false);
      commitPanelWidth(width);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      commitPanelWidth(width - KEYBOARD_RESIZE_STEP * direction);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      commitPanelWidth(width + KEYBOARD_RESIZE_STEP * direction);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (collapsible) setCollapsed(true);
      else commitPanelWidth(bounds.minSize);
    } else if (event.key === "End") {
      event.preventDefault();
      commitPanelWidth(bounds.maxSize);
    }
  };

  const resizablePanelNode = (
    <Flex
      id={resizablePanelId}
      ref={resizablePanelRef}
      display={collapsed ? "none" : "flex"}
      h="full"
      minW="0"
      minH="0"
      overflow="hidden"
      flex={`0 0 ${resolvedPanelWidth}px`}
      w={`${resolvedPanelWidth}px`}
      aria-hidden={collapsed ? true : undefined}
    >
      {resizablePanel}
    </Flex>
  );
  const contentPanelNode = (
    <Flex
      id={contentPanelId}
      ref={contentPanelRef}
      display="flex"
      h="full"
      minW="0"
      minH="0"
      overflow="hidden"
      flex="1"
    >
      {contentPanel}
    </Flex>
  );
  const resizeTrigger = collapsed ? null : (
    <ResizeHandle
      bounds={bounds}
      contentPanelId={contentPanelId}
      resizablePanelId={resizablePanelId}
      resizeLabel={resizeLabel}
      resolvedPanelWidth={resolvedPanelWidth}
      showResizeSeparator={showResizeSeparator}
      onResizeKeyDown={handleResizeKeyDown}
      onResizeStart={handleResizeStart}
    />
  );

  return (
    <Flex ref={rootRef} direction="row" h="full" w="full" overflow="hidden" {...rest}>
      {resizableSide === "left" ? (
        <>
          {resizablePanelNode}
          {resizeTrigger}
          {contentPanelNode}
        </>
      ) : (
        <>
          {contentPanelNode}
          {resizeTrigger}
          {resizablePanelNode}
        </>
      )}
    </Flex>
  );
};
