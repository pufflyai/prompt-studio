import { Box, type SystemStyleObject } from "@chakra-ui/react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { useLayoutEffect } from "react";
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
  useLayoutEffect(() => {
    const root = rootRef.current;
    const panel = resizablePanelRef.current;
    const content = contentPanelRef.current;
    const separator = separatorRef.current;
    if (!root || !panel || !content || !separator) return;
    const move = (node: HTMLElement, before: HTMLElement | null) => {
      if (node.nextSibling === before) return;
      if (root.moveBefore) root.moveBefore(node, before);
      // Temporary WebKit fallback: ADR 0053 covers iframe reloads during explicit moves.
      else root.insertBefore(node, before);
    };
    // Keep reading and focus order aligned with placement without resetting connected iframes.
    move(axis.panelFirst ? panel : content, separator);
    move(axis.panelFirst ? content : panel, null);
  });

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
    <Box ref={separatorRef} css={styles.separator} aria-hidden="true" />
  );

  // Keep React's child order stable; the layout effect owns state-preserving DOM moves.
  return (
    <>
      {resizablePanelNode}
      {resizeTrigger}
      {contentPanelNode}
    </>
  );
};
