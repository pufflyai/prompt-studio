import { type ConditionalValue, Flex, type FlexProps, useSlotRecipe } from "@chakra-ui/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  FALLBACK_ROOT_SIZE,
  getResizableSplitAxis,
  type ResizableSplitSide,
  resolveResizableBounds,
} from "@/components/layout/resizable-split-layout.geometry";
import type { ResizableSplitSeparator } from "@/components/layout/resizable-split-layout.handle";
import { ResizableSplitPanels } from "@/components/layout/resizable-split-layout.panels";
import { type PanelDimension, useResizableSplitRootSize } from "@/components/layout/resizable-split-layout.root-size";
import { createResizeStartHandler } from "./resizable-split-layout.drag";
import { createResizeKeyDownHandler } from "./resizable-split-layout.keyboard";

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
  resizable?: boolean;
  resizeLabel?: string;
  separator?: ResizableSplitSeparator;
  layout?: ConditionalValue<"split" | "stacked" | "stacked-reverse" | "content">;
  onSizeChange?: (size: number) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getElementSize = (element: HTMLDivElement | null, dimension: PanelDimension) =>
  element?.getBoundingClientRect()[dimension] ?? 0;

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
    resizable = true,
    resizeLabel = "Resize panel",
    separator = "gap",
    layout = "split",
    onSizeChange,
    onCollapsedChange,
    ...rest
  } = props;
  const axis = getResizableSplitAxis(resizableSide);
  const orientation = axis.dimension === "width" ? "horizontal" : "vertical";
  const styles = useSlotRecipe({ key: "resizableSplitLayout" })({ orientation, layout, separator });
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const resizablePanelRef = useRef<HTMLDivElement>(null);
  const contentPanelRef = useRef<HTMLDivElement>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  const cleanupDragRef = useRef<() => void>(() => undefined);
  const { rootSize, separatorSize } = useResizableSplitRootSize(rootRef, separatorRef, axis.dimension);
  const lastSizeRef = useRef(defaultSizePx);
  const [panelSize, setPanelSize] = useState(defaultSizePx);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const bounds = resolveResizableBounds({
    rootSize,
    fallbackRootSize: FALLBACK_ROOT_SIZE[axis.dimension],
    minSize: minSizePx,
    maxSize: maxSizePx,
    contentMinSize: contentMinSizePx,
    separatorSize,
  });
  const resolvedPanelSize = collapsed ? 0 : clamp(panelSize, bounds.minSize, bounds.maxSize);
  const contentPanelId = `${id}-content`;
  const resizablePanelId = `${id}-resizable`;
  const sizeStyle = {
    ...rest.style,
    "--split-size": `${resolvedPanelSize}px`,
    "--split-stored-size": `${clamp(panelSize, bounds.minSize, bounds.maxSize)}px`,
  };

  useEffect(() => {
    lastSizeRef.current = defaultSizePx;
    setPanelSize(defaultSizePx);
  }, [defaultSizePx]);

  useEffect(() => () => cleanupDragRef.current(), []);

  const applyPanelSize = (size: number) => {
    // Keep the retained size owned by React so dragging closed cannot overwrite it.
    rootRef.current?.style.setProperty("--split-size", `${size}px`);
  };

  const commitPanelSize = (size: number) => {
    const nextBounds = resolveResizableBounds({
      rootSize: getElementSize(rootRef.current, axis.dimension),
      fallbackRootSize: FALLBACK_ROOT_SIZE[axis.dimension],
      minSize: minSizePx,
      maxSize: maxSizePx,
      contentMinSize: contentMinSizePx,
      separatorSize: getElementSize(separatorRef.current, axis.dimension),
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

  const handleResizeStart = createResizeStartHandler({
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
  });

  const handleCollapse = () => {
    if (collapsible) setCollapsed(true);
  };

  const handleResizeKeyDown = createResizeKeyDownHandler({
    dimension: axis.dimension,
    deltaDirection: axis.deltaDirection,
    collapsed,
    collapsible,
    minSize: bounds.minSize,
    maxSize: bounds.maxSize,
    getSize: () => lastSizeRef.current,
    setCollapsed,
    commitSize: commitPanelSize,
  });

  return (
    <Flex
      ref={rootRef}
      css={styles.root}
      {...rest}
      style={sizeStyle}
      data-collapsed={collapsed}
      data-dragging={dragging}
    >
      <ResizableSplitPanels
        resizable={resizable}
        styles={styles}
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
        rootRef={rootRef}
        dragging={dragging}
        resizeLabel={resizeLabel}
        resolvedPanelSize={resolvedPanelSize}
        separator={separator}
        separatorRef={separatorRef}
        onCollapse={handleCollapse}
        onResizeKeyDown={handleResizeKeyDown}
        onResizeStart={handleResizeStart}
      />
    </Flex>
  );
};
