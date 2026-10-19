import { Box, type SystemStyleObject } from "@chakra-ui/react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type { getResizableSplitAxis } from "@/components/layout/resizable-split-layout.geometry";
import { type ResizableSplitSeparator, ResizeHandle } from "@/components/layout/resizable-split-layout.handle";
import { SplitPanelMotionContext } from "./split-panel-motion-context";

interface ResizableSplitPanelsProps {
  styles: Record<"resizablePanel" | "panelContent" | "contentPanel" | "separator", SystemStyleObject>;
  axis: ReturnType<typeof getResizableSplitAxis>;
  bounds: { minSize: number; maxSize: number };
  collapsed: boolean;
  collapsible: boolean;
  resizable: boolean;
  contentPanel: ReactNode;
  contentPanelId: string;
  contentPanelRef: RefObject<HTMLDivElement | null>;
  resizablePanel: ReactNode;
  resizablePanelId: string;
  resizablePanelRef: RefObject<HTMLDivElement | null>;
  rootRef: RefObject<HTMLDivElement | null>;
  dragging: boolean;
  resizeLabel: string;
  resolvedPanelSize: number;
  separator: ResizableSplitSeparator;
  separatorRef: RefObject<HTMLDivElement | null>;
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
    resizable,
    contentPanel,
    contentPanelId,
    contentPanelRef,
    resizablePanel,
    resizablePanelId,
    resizablePanelRef,
    rootRef,
    dragging,
    resizeLabel,
    resolvedPanelSize,
    separator,
    separatorRef,
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
      inert={collapsed}
    >
      <Box css={styles.panelContent} data-split-panel-content="">
        <SplitPanelMotionContext value={rootRef}>{resizablePanel}</SplitPanelMotionContext>
      </Box>
    </Box>
  );
  const contentPanelNode = (
    <Box key="content-panel" id={contentPanelId} ref={contentPanelRef} css={styles.contentPanel}>
      {contentPanel}
    </Box>
  );
  const resizeTrigger = resizable ? (
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
      separatorRef={separatorRef}
      onCollapse={onCollapse}
      onResizeKeyDown={onResizeKeyDown}
      onResizeStart={onResizeStart}
    />
  ) : (
    <Box css={styles.separator} aria-hidden="true" />
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
