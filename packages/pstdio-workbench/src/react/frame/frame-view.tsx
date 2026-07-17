import { Flex } from "@chakra-ui/react";
import { type SplitPane, SplitView } from "@pstdio/ui";
import type { Frame, FrameNode, FrameSlot, WorkbenchCore } from "../../core";
import { setWorkbenchPanelOpen } from "../workbench/workbench-panel-state";
import { isFixedSlotSize, resolveSlotSize } from "./frame-size";
import { WorkbenchFrameSlot } from "./frame-slot";
import { containsFrameSlot, resolveResizableSlot } from "./frame-tree";
import {
  type FrameStoreSnapshot,
  isFrameNodeVisible,
  resolveFrameSlotCollapsible,
  resolveFrameSlotState,
  useFrameStoreSnapshot,
} from "./use-frame-slot-state";

interface FrameViewProps {
  workbench: WorkbenchCore;
  frame: Frame;
  node: FrameNode;
}

interface FrameNodeViewProps extends FrameViewProps {
  snapshot: FrameStoreSnapshot;
}

const FrameSlotView = (props: FrameNodeViewProps & { node: FrameSlot }) => {
  const { workbench, frame, node, snapshot } = props;
  const state = resolveFrameSlotState(workbench, node, snapshot);
  if (!state.has) return null;

  return <WorkbenchFrameSlot workbench={workbench} frame={frame} slot={node} />;
};

const getResizeLabel = (slotId: string) =>
  slotId === "secondary" ? "Resize main-bottom panel" : `Resize ${slotId} panel`;

interface FrameStaticSplitProps {
  direction: "row" | "column";
  panes: SplitPane[];
}

const FrameStaticSplit = (props: FrameStaticSplitProps) => {
  const { direction, panes } = props;

  return (
    <Flex direction={direction} h="full" minH="0" minW="0" w="full" overflow="hidden">
      {panes.map((pane) => {
        const length = pane.sizePx === undefined ? "full" : `${pane.sizePx}px`;
        return (
          <Flex
            key={pane.id}
            display={pane.collapsed ? "none" : "flex"}
            flex={pane.sizePx === undefined ? "1" : `0 0 ${length}`}
            h={direction === "column" ? length : "full"}
            minH="0"
            minW="0"
            w={direction === "row" ? length : "full"}
            overflow="hidden"
          >
            {pane.content}
          </Flex>
        );
      })}
    </Flex>
  );
};

const FrameSplitView = (props: FrameNodeViewProps & { node: Extract<FrameNode, { kind: "split" }> }) => {
  const { workbench, frame, node, snapshot } = props;
  const declaredContentChildren = node.children;
  const contentChildren = node.children.filter((child) => isFrameNodeVisible(frame, snapshot, child));

  if (contentChildren.length === 0) return null;

  if (declaredContentChildren.length === 1) {
    const child = contentChildren[0];
    if (!child) return null;
    return <FrameNodeView workbench={workbench} frame={frame} node={child} snapshot={snapshot} />;
  }

  const resizableSlots = new Map<string, FrameSlot>();
  const panes: SplitPane[] = contentChildren.map((child) => {
    const resizableSlot = resolveResizableSlot(child);
    const size = resizableSlot
      ? resolveSlotSize(resizableSlot, workbench.layout.getAreaSize(resizableSlot.id))
      : undefined;
    if (resizableSlot && size?.defaultPx !== undefined && !isFixedSlotSize(size)) {
      resizableSlots.set(child.id, resizableSlot);
    }
    const collapsible = resizableSlot ? resolveFrameSlotCollapsible(workbench, frame, resizableSlot.id) : false;
    const collapsed = resizableSlot ? !(snapshot.openByAreaId[resizableSlot.id] ?? true) && collapsible : false;
    const primaryMinimum = containsFrameSlot(child, frame.primary) ? (node.direction === "row" ? 320 : 240) : undefined;

    return {
      id: child.id,
      content: <FrameNodeView workbench={workbench} frame={frame} node={child} snapshot={snapshot} />,
      sizePx: size?.defaultPx,
      minSizePx: size?.minPx ?? primaryMinimum,
      maxSizePx: size?.maxPx,
      collapsed,
      collapsible,
    };
  });

  const content =
    panes.length === 1 ? (
      panes[0]?.content
    ) : resizableSlots.size === 0 ? (
      <FrameStaticSplit direction={node.direction} panes={panes} />
    ) : (
      <SplitView
        direction={node.direction}
        panes={panes}
        resizeHandleSizePx={node.direction === "column" ? 8 : undefined}
        resizeHandleOverlap={node.direction === "row"}
        resizeLabel={(handleIndex) => {
          const before = panes[handleIndex];
          const after = panes[handleIndex + 1];
          const slot = (before && resizableSlots.get(before.id)) ?? (after && resizableSlots.get(after.id));
          return slot ? getResizeLabel(slot.id) : "Resize panel";
        }}
        showResizeSeparator
        onSizeChange={(paneId, size) => {
          const slot = resizableSlots.get(paneId);
          if (slot) workbench.layout.setAreaSize(slot.id, size);
        }}
        onCollapsedChange={(paneId, collapsed) => {
          const slot = resizableSlots.get(paneId);
          if (slot) setWorkbenchPanelOpen(workbench, slot.id, !collapsed);
        }}
      />
    );

  return content;
};

const FrameNodeView = (props: FrameNodeViewProps) =>
  props.node.kind === "slot" ? (
    <FrameSlotView {...props} node={props.node} />
  ) : (
    <FrameSplitView {...props} node={props.node} />
  );

export const FrameView = (props: FrameViewProps) => {
  const snapshot = useFrameStoreSnapshot(props.workbench);
  return <FrameNodeView {...props} snapshot={snapshot} />;
};
