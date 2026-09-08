import { Flex } from "@chakra-ui/react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type { getResizableSplitAxis } from "@/components/layout/resizable-split-layout.geometry";
import { type ResizableSplitSeparator, ResizeHandle } from "@/components/layout/resizable-split-layout.handle";

interface ResizableSplitPanelsProps {
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
    <Flex
      key="resizable-panel"
      id={resizablePanelId}
      ref={resizablePanelRef}
      display={collapsed ? "none" : "flex"}
      h={axis.dimension === "height" ? `${resolvedPanelSize}px` : "full"}
      minW="0"
      minH="0"
      overflow="hidden"
      flex={`0 0 ${resolvedPanelSize}px`}
      w={axis.dimension === "width" ? `${resolvedPanelSize}px` : "full"}
      aria-hidden={collapsed ? true : undefined}
    >
      {resizablePanel}
    </Flex>
  );
  const contentPanelNode = (
    <Flex
      key="content-panel"
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
  const resizeTrigger = (
    <ResizeHandle
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
