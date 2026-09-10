import { Box, type SystemStyleObject } from "@chakra-ui/react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type { getResizableSplitAxis } from "@/components/layout/resizable-split-layout.geometry";
import { type ResizableSplitSeparator, ResizeHandle } from "@/components/layout/resizable-split-layout.handle";

interface ResizableSplitPanelsProps {
  styles: Record<"resizablePanel" | "contentPanel" | "separator", SystemStyleObject>;
  axis: ReturnType<typeof getResizableSplitAxis>;
  bounds: { minSize: number; maxSize: number };
  collapsed: boolean;
  collapsible: boolean;
  contentPanel: ReactNode;
  contentPanelId: string;
  contentPanelRef: RefObject<HTMLDivElement | null>;
  resizablePanel: ReactNode;
  resizablePanelId: string;
  resizablePanelRef: RefObject<HTMLDivElement | null>;
  dragging: boolean;
  resizeLabel: string;
  resolvedPanelSize: number;
  separator: ResizableSplitSeparator;
  onCollapse: () => void;
  onResizeKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export const ResizableSplitPanels = (props: ResizableSplitPanelsProps) => {
  const {
    styles,
    axis,
    bounds,
    collapsed,
    collapsible,
    contentPanel,
    contentPanelId,
    contentPanelRef,
    resizablePanel,
    resizablePanelId,
    resizablePanelRef,
    dragging,
    resizeLabel,
    resolvedPanelSize,
    separator,
    onCollapse,
    onResizeKeyDown,
    onResizeStart,
  } = props;
  const resizablePanelNode = (
    <Box
      key="resizable-panel"
      id={resizablePanelId}
      ref={resizablePanelRef}
      css={styles.resizablePanel}
      data-collapsed={collapsed}
      aria-hidden={collapsed ? true : undefined}
    >
      {resizablePanel}
    </Box>
  );
  const contentPanelNode = (
    <Box key="content-panel" id={contentPanelId} ref={contentPanelRef} css={styles.contentPanel}>
      {contentPanel}
    </Box>
  );
  const resizeTrigger = (
    <ResizeHandle
      css={styles.separator}
      key="resize-handle"
      axis={axis}
      bounds={bounds}
      collapsed={collapsed}
      collapsible={collapsible}
      contentPanelId={contentPanelId}
      resizablePanelId={resizablePanelId}
      dragging={dragging}
      resizeLabel={resizeLabel}
      resolvedPanelSize={resolvedPanelSize}
      separator={separator}
      onCollapse={onCollapse}
      onResizeKeyDown={onResizeKeyDown}
      onResizeStart={onResizeStart}
    />
  );

  if (axis.panelFirst) {
    return (
      <>
        {resizablePanelNode}
        {resizeTrigger}
        {contentPanelNode}
      </>
    );
  }

  return (
    <>
      {contentPanelNode}
      {resizeTrigger}
      {resizablePanelNode}
    </>
  );
};
