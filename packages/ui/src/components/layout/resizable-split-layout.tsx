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
import {
  getResizableSplitAxis,
  type ResizableSplitSide,
  resolveDraggedPanelSize,
  resolveResizableBounds,
} from "@/components/layout/resizable-split-layout.geometry";
import { ResizableSplitPanels } from "@/components/layout/resizable-split-layout.panels";

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
  onSizeChange?: (size: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const FALLBACK_ROOT_SIZE = { width: 1200, height: 720 };
const KEYBOARD_RESIZE_STEP = 24;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type PanelDimension = "width" | "height";

const getElementSize = (element: HTMLDivElement | null, dimension: PanelDimension) =>
  element?.getBoundingClientRect()[dimension] ?? 0;

const applyPanelSizeToElement = (panel: HTMLDivElement | null, size: number, dimension: PanelDimension) => {
  if (!panel) return;

  panel.style[dimension] = `${size}px`;
  panel.style.flexBasis = `${size}px`;
  panel.style.flexGrow = "0";
  panel.style.flexShrink = "0";
  panel.style.display = size > 0 ? "flex" : "none";
};

const clearPanelInlineStyles = (panel: HTMLDivElement | null) => {
  if (!panel) return;

  panel.style.width = "";
  panel.style.height = "";
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
  const axis = getResizableSplitAxis(resizableSide);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const resizablePanelRef = useRef<HTMLDivElement>(null);
  const contentPanelRef = useRef<HTMLDivElement>(null);
  const cleanupDragRef = useRef<() => void>(() => undefined);
  const lastSizeRef = useRef(defaultSizePx);
  const [panelSize, setPanelSize] = useState(defaultSizePx);
  const [rootSize, setRootSize] = useState(0);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const bounds = resolveResizableBounds({
    rootSize,
    fallbackRootSize: FALLBACK_ROOT_SIZE[axis.dimension],
    minSize: minSizePx,
    maxSize: maxSizePx,
    contentMinSize: contentMinSizePx,
  });
  const resolvedPanelSize = collapsed ? 0 : clamp(panelSize, bounds.minSize, bounds.maxSize);
  const contentPanelId = `${id}-content`;
  const resizablePanelId = `${id}-resizable`;

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const updateRootSize = () => {
      setRootSize(element.getBoundingClientRect()[axis.dimension]);
    };

    updateRootSize();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateRootSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [axis.dimension]);

  useEffect(() => {
    lastSizeRef.current = defaultSizePx;
    setPanelSize(defaultSizePx);
  }, [defaultSizePx]);

  useEffect(() => () => cleanupDragRef.current(), []);

  const applyPanelSize = (size: number) => {
    applyPanelSizeToElement(resizablePanelRef.current, size, axis.dimension);
  };

  useEffect(() => {
    // React may reuse the same DOM element across renders when this component swaps roles
    // (e.g., a wrapping ResizableSplitLayout disappears, leaving the inner one in its place).
    // Clear any inline styles on the content panel that leaked from a prior render where
    // the same DOM element was the resizable panel; otherwise stale `flex: 0 0 Xpx` pins
    // the content's width.
    clearPanelInlineStyles(contentPanelRef.current);
    clearPanelInlineStyles(resizablePanelRef.current);
    applyPanelSizeToElement(resizablePanelRef.current, resolvedPanelSize, axis.dimension);
  }, [axis.dimension, resolvedPanelSize]);

  const commitPanelSize = (size: number) => {
    const nextBounds = resolveResizableBounds({
      rootSize: getElementSize(rootRef.current, axis.dimension),
      fallbackRootSize: FALLBACK_ROOT_SIZE[axis.dimension],
      minSize: minSizePx,
      maxSize: maxSizePx,
      contentMinSize: contentMinSizePx,
    });
    const nextSize = clamp(size, nextBounds.minSize, nextBounds.maxSize);

    lastSizeRef.current = nextSize;
    setPanelSize(nextSize);
    applyPanelSize(nextSize);
    onSizeChange?.(nextSize);
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
    const bounds = resolveResizableBounds({
      rootSize: getElementSize(rootRef.current, axis.dimension),
      fallbackRootSize: FALLBACK_ROOT_SIZE[axis.dimension],
      minSize: minSizePx,
      maxSize: maxSizePx,
      contentMinSize: contentMinSizePx,
    });
    const startPointer = event[axis.pointerCoordinate];
    const startSize = collapsed ? 0 : getElementSize(resizablePanelRef.current, axis.dimension) || lastSizeRef.current;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let nextSize = startSize === 0 ? 0 : clamp(startSize, bounds.minSize, bounds.maxSize);
    let nextCollapsed = collapsed;
    let animationFrame = 0;

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
      const result = resolveDraggedPanelSize({
        side: resizableSide,
        startSize,
        pointerDelta: moveEvent[axis.pointerCoordinate] - startPointer,
        minSize: bounds.minSize,
        maxSize: bounds.maxSize,
        collapsible,
      });
      nextCollapsed = result.collapsed;
      nextSize = result.size;
      schedulePanelSize();
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
        applyPanelSize(0);
        setCollapsed(true);
      } else {
        setCollapsed(false);
        commitPanelSize(nextSize);
      }
    };

    cleanupDragRef.current = cleanup;
    resizeHandle.setPointerCapture(event.pointerId);
    document.body.style.cursor = axis.cursor;
    document.body.style.userSelect = "none";
    setDraggingPanelState("none");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup, { once: true });
    window.addEventListener("pointercancel", cleanup, { once: true });
    window.addEventListener("blur", cleanup, { once: true });
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const negativeDirectionKey = axis.dimension === "width" ? "ArrowLeft" : "ArrowUp";
    const positiveDirectionKey = axis.dimension === "width" ? "ArrowRight" : "ArrowDown";
    const size = lastSizeRef.current;

    if (
      collapsed &&
      (event.key === negativeDirectionKey || event.key === positiveDirectionKey || event.key === "End")
    ) {
      event.preventDefault();
      setCollapsed(false);
      commitPanelSize(size);
    } else if (event.key === negativeDirectionKey) {
      event.preventDefault();
      commitPanelSize(size - KEYBOARD_RESIZE_STEP * axis.deltaDirection);
    } else if (event.key === positiveDirectionKey) {
      event.preventDefault();
      commitPanelSize(size + KEYBOARD_RESIZE_STEP * axis.deltaDirection);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (collapsible) setCollapsed(true);
      else commitPanelSize(bounds.minSize);
    } else if (event.key === "End") {
      event.preventDefault();
      commitPanelSize(bounds.maxSize);
    }
  };

  return (
    <Flex ref={rootRef} direction={axis.rootDirection} h="full" w="full" overflow="hidden" {...rest}>
      <ResizableSplitPanels
        axis={axis}
        bounds={bounds}
        collapsed={collapsed}
        collapsible={collapsible}
        contentPanel={contentPanel}
        contentPanelId={contentPanelId}
        contentPanelRef={contentPanelRef}
        resizablePanel={resizablePanel}
        resizablePanelId={resizablePanelId}
        resizablePanelRef={resizablePanelRef}
        resizeLabel={resizeLabel}
        resolvedPanelSize={resolvedPanelSize}
        showResizeSeparator={showResizeSeparator}
        onResizeKeyDown={handleResizeKeyDown}
        onResizeStart={handleResizeStart}
      />
    </Flex>
  );
};
