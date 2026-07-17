import { Flex, type FlexProps } from "@chakra-ui/react";
import {
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { applyPaneSizeToElement, clearPaneInlineStyles, getElementSize, type SplitDirection } from "./split-view.dom";
import { createSplitViewResizeStart } from "./split-view.drag";
import {
  clamp,
  redistributePaneSizes,
  resolvePaneBounds,
  resolveReservedPaneSize,
  type SplitPaneGeometry,
} from "./split-view.geometry";
import { SplitViewHandle } from "./split-view.handle";

export interface SplitPane extends SplitPaneGeometry {
  content: ReactNode;
  collapsed?: boolean;
  collapsible?: boolean;
}

export interface SplitViewProps extends Omit<FlexProps, "children" | "onResize"> {
  direction?: SplitDirection;
  panes: SplitPane[];
  resizeLabel?: (handleIndex: number) => string;
  showResizeSeparator?: boolean;
  onSizeChange?: (paneId: string, size: number) => void;
  onCollapsedChange?: (paneId: string, collapsed: boolean) => void;
}

const KEYBOARD_RESIZE_STEP = 24;

interface KeyboardResizeDeltaInput {
  direction: SplitDirection;
  key: string;
  controlledBefore: boolean;
  currentSize: number;
  bounds: { minSize: number; maxSize: number };
}

const resolveKeyboardResizeDelta = (input: KeyboardResizeDeltaInput) => {
  const { direction, key, controlledBefore, currentSize, bounds } = input;
  if (key === "ArrowLeft" && direction === "row") return -KEYBOARD_RESIZE_STEP;
  if (key === "ArrowRight" && direction === "row") return KEYBOARD_RESIZE_STEP;
  if (key === "ArrowUp" && direction === "column") return -KEYBOARD_RESIZE_STEP;
  if (key === "ArrowDown" && direction === "column") return KEYBOARD_RESIZE_STEP;
  if (key === "End") return controlledBefore ? bounds.maxSize - currentSize : currentSize - bounds.maxSize;
  if (key === "Home") return controlledBefore ? bounds.minSize - currentSize : currentSize - bounds.minSize;
  return undefined;
};

const getPaneLength = (fillsAxis: boolean, size?: number) => {
  if (fillsAxis) return "full";
  if (size === undefined) return undefined;
  return `${size}px`;
};

export const SplitView = (props: SplitViewProps) => {
  const {
    direction = "row",
    panes,
    resizeLabel,
    showResizeSeparator = true,
    onSizeChange,
    onCollapsedChange,
    ...rest
  } = props;
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef(new Map<string, HTMLDivElement>());
  const cleanupDragRef = useRef<() => void>(() => undefined);
  const externalSizesRef = useRef<Record<string, number | undefined>>(
    Object.fromEntries(panes.map((pane) => [pane.id, pane.sizePx])),
  );
  const [rootSize, setRootSize] = useState(0);
  const [paneSizes, setPaneSizes] = useState<Record<string, number>>(() =>
    Object.fromEntries(panes.flatMap((pane) => (pane.sizePx === undefined ? [] : [[pane.id, pane.sizePx]]))),
  );
  const [internalCollapsed, setInternalCollapsed] = useState<Record<string, boolean>>({});

  const isPaneCollapsed = (pane: SplitPane) => pane.collapsed ?? internalCollapsed[pane.id] ?? false;

  const getReservedSize = (pane: SplitPane) => {
    if (isPaneCollapsed(pane)) return 0;
    return resolveReservedPaneSize(pane, paneSizes[pane.id]);
  };

  const getResolvedPaneSize = (pane: SplitPane) => {
    const size = paneSizes[pane.id] ?? pane.sizePx ?? 0;
    const contentMinSizePx = panes
      .filter((candidate) => candidate.id !== pane.id)
      .reduce((total, candidate) => total + getReservedSize(candidate), 0);
    const bounds = resolvePaneBounds({
      rootSize,
      minSizePx: pane.minSizePx,
      maxSizePx: pane.maxSizePx,
      contentMinSizePx,
    });

    return clamp(size, bounds.minSize, bounds.maxSize);
  };

  const getAvailablePairSize = (before: SplitPane, after: SplitPane) => {
    const reservedSize = panes
      .filter((pane) => pane.id !== before.id && pane.id !== after.id)
      .reduce((total, pane) => total + getReservedSize(pane), 0);

    return Math.max(0, rootSize - reservedSize);
  };

  const getPairGeometry = (before: SplitPane, after: SplitPane) => ({
    before: {
      ...before,
      sizePx: before.sizePx === undefined ? undefined : getResolvedPaneSize(before),
    },
    after: {
      ...after,
      sizePx: after.sizePx === undefined ? undefined : getResolvedPaneSize(after),
    },
  });

  const getControlledPane = (before: SplitPane, after: SplitPane) => {
    if (before.sizePx !== undefined) return before;
    return after.sizePx === undefined ? undefined : after;
  };

  const getControlledBounds = (before: SplitPane, after: SplitPane) => {
    const controlled = getControlledPane(before, after);
    if (!controlled) return { minSize: 0, maxSize: 0 };
    const other = controlled.id === before.id ? after : before;

    return resolvePaneBounds({
      rootSize: getAvailablePairSize(before, after),
      minSizePx: controlled.minSizePx,
      maxSizePx: controlled.maxSizePx,
      contentMinSizePx: other.minSizePx,
    });
  };

  const setPaneCollapsed = (pane: SplitPane, collapsed: boolean) => {
    if (pane.collapsed === undefined) {
      setInternalCollapsed((current) => ({ ...current, [pane.id]: collapsed }));
    }
    onCollapsedChange?.(pane.id, collapsed);
  };

  const commitSizes = (sizes: Array<{ id: string; sizePx: number }>) => {
    setPaneSizes((current) => ({
      ...current,
      ...Object.fromEntries(sizes.map((size) => [size.id, size.sizePx])),
    }));
    for (const size of sizes) onSizeChange?.(size.id, size.sizePx);
  };

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const updateRootSize = () => setRootSize(getElementSize(element, direction));
    updateRootSize();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateRootSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [direction]);

  useEffect(() => {
    const changedSizes = panes.flatMap((pane) => {
      const previous = externalSizesRef.current[pane.id];
      if (pane.sizePx === undefined || pane.sizePx === previous) return [];
      return [[pane.id, pane.sizePx] as const];
    });
    externalSizesRef.current = Object.fromEntries(panes.map((pane) => [pane.id, pane.sizePx]));
    if (changedSizes.length === 0) return;
    setPaneSizes((current) => ({ ...current, ...Object.fromEntries(changedSizes) }));
  }, [panes]);

  useEffect(() => {
    // React can reuse a pane element when a wrapping split disappears. Clear spring
    // panes before applying sizes so stale imperative drag geometry cannot pin them.
    for (const pane of panes) {
      const element = paneRefs.current.get(pane.id) ?? null;
      const collapsed = isPaneCollapsed(pane);
      if (pane.sizePx === undefined) clearPaneInlineStyles(element, collapsed);
      else applyPaneSizeToElement(element, direction, collapsed ? 0 : getResolvedPaneSize(pane));
    }
  });

  useEffect(() => () => cleanupDragRef.current(), []);

  const resizeWithKeyboard = (handleIndex: number, deltaPx: number) => {
    const before = panes[handleIndex];
    const after = panes[handleIndex + 1];
    if (!before || !after) return;
    const geometry = getPairGeometry(before, after);
    const sizes = redistributePaneSizes({
      rootSize: getAvailablePairSize(before, after),
      deltaPx,
      ...geometry,
    });
    const controlled = getControlledPane(before, after);
    if (controlled) setPaneCollapsed(controlled, false);
    commitSizes(sizes);
  };

  const handleResizeKeyDown = (handleIndex: number, event: ReactKeyboardEvent<HTMLDivElement>) => {
    const before = panes[handleIndex];
    const after = panes[handleIndex + 1];
    if (!before || !after) return;
    const controlled = getControlledPane(before, after);
    if (!controlled) return;
    const bounds = getControlledBounds(before, after);
    const currentSize = getResolvedPaneSize(controlled);
    const controlledBefore = controlled.id === before.id;
    if (event.key === "Home" && controlled.collapsible !== false) {
      event.preventDefault();
      setPaneCollapsed(controlled, true);
      return;
    }
    const deltaPx = resolveKeyboardResizeDelta({ direction, key: event.key, controlledBefore, currentSize, bounds });
    if (deltaPx === undefined) return;

    event.preventDefault();
    resizeWithKeyboard(handleIndex, deltaPx);
  };

  const handleResizeStart = createSplitViewResizeStart({
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
  });

  return (
    <Flex ref={rootRef} direction={direction} h="full" w="full" overflow="hidden" {...rest}>
      {panes.map((pane, index) => {
        const collapsed = isPaneCollapsed(pane);
        const resolvedSize = pane.sizePx === undefined ? undefined : getResolvedPaneSize(pane);
        const after = panes[index + 1];
        const showHandle = Boolean(after && !collapsed && !isPaneCollapsed(after) && getControlledPane(pane, after));
        const paneHeight = getPaneLength(direction === "row", resolvedSize);
        const paneWidth = getPaneLength(direction === "column", resolvedSize);

        return (
          <Fragment key={pane.id}>
            <Flex
              id={`${id}-${pane.id}`}
              ref={(element) => {
                if (element) paneRefs.current.set(pane.id, element);
                else paneRefs.current.delete(pane.id);
              }}
              display={collapsed ? "none" : "flex"}
              h={paneHeight}
              w={paneWidth}
              minW="0"
              minH="0"
              overflow="hidden"
              flex={resolvedSize === undefined ? "1" : `0 0 ${resolvedSize}px`}
              aria-hidden={collapsed ? true : undefined}
            >
              {pane.content}
            </Flex>
            {showHandle ? (
              <SplitViewHandle
                direction={direction}
                bounds={getControlledBounds(pane, after)}
                controlledPaneIds={`${id}-${pane.id} ${id}-${after.id}`}
                resizeLabel={resizeLabel?.(index) ?? "Resize panel"}
                resolvedPaneSize={getResolvedPaneSize(getControlledPane(pane, after) ?? pane)}
                showResizeSeparator={showResizeSeparator}
                onResizeKeyDown={(event) => handleResizeKeyDown(index, event)}
                onResizeStart={(event) => handleResizeStart(index, event)}
              />
            ) : null}
          </Fragment>
        );
      })}
    </Flex>
  );
};
