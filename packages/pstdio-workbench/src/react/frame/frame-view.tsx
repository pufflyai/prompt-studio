import { Flex } from "@chakra-ui/react";
import { type SplitPane, SplitView } from "@pstdio/ui";
import type { Frame, FrameNode, FrameSlot, WorkbenchCore } from "../../core";
import { setWorkbenchPanelOpen } from "../workbench/workbench-panel-state";
import { FrameHeader } from "./frame-header";
import { FrameRegion } from "./frame-region";
import { resolveSlotSize } from "./frame-size";
import { containsFrameSlot, isHeaderSlot, resolveHeaderTargetId, resolveResizableSlot } from "./frame-tree";
import {
  isFrameNodeVisible,
  resolveFrameSlotCollapsible,
  useFrameSlotState,
  useFrameStoreSnapshot,
} from "./use-frame-slot-state";

interface FrameViewProps {
  workbench: WorkbenchCore;
  frame: Frame;
  node: FrameNode;
  attachedHeaders?: Readonly<Record<string, FrameSlot>>;
  claimedHeaderTargets?: ReadonlySet<string>;
}

const FrameSlotView = (props: FrameViewProps & { node: FrameSlot }) => {
  const { workbench, frame, node, attachedHeaders = {}, claimedHeaderTargets = new Set() } = props;
  const headerSlot = attachedHeaders[node.id];
  const state = useFrameSlotState(workbench, node, headerSlot);
  if (!state.has) return null;

  return (
    <FrameRegion
      workbench={workbench}
      frame={frame}
      slot={node}
      headerSlot={headerSlot}
      headerClaimed={claimedHeaderTargets.has(node.id)}
    />
  );
};

const getResizeLabel = (slotId: string) =>
  slotId === "secondary" ? "Resize main-bottom panel" : `Resize ${slotId} panel`;

const FrameSplitView = (props: FrameViewProps & { node: Extract<FrameNode, { kind: "split" }> }) => {
  const { workbench, frame, node, attachedHeaders = {}, claimedHeaderTargets = new Set<string>() } = props;
  const snapshot = useFrameStoreSnapshot(workbench);
  const directHeaders = node.children.filter(isHeaderSlot);
  const declaredContentChildren = node.children.filter((child) => !isHeaderSlot(child));
  const contentChildren = declaredContentChildren.filter((child) => isFrameNodeVisible(frame, snapshot, child));

  if (contentChildren.length === 0) return null;

  if (declaredContentChildren.length === 1) {
    const child = contentChildren[0];
    if (!child) return null;
    const nextAttachedHeaders = { ...attachedHeaders };
    for (const header of directHeaders) {
      const targetId = resolveHeaderTargetId(header);
      if (containsFrameSlot(child, targetId)) nextAttachedHeaders[targetId] = header;
    }
    return (
      <FrameView
        workbench={workbench}
        frame={frame}
        node={child}
        attachedHeaders={nextAttachedHeaders}
        claimedHeaderTargets={claimedHeaderTargets}
      />
    );
  }

  const nextClaimedHeaderTargets = new Set(claimedHeaderTargets);
  const externalHeaders = directHeaders.flatMap((header) => {
    const targetId = resolveHeaderTargetId(header);
    const targetSlot = frame.slots[targetId];
    if (!targetSlot) return [];
    nextClaimedHeaderTargets.add(targetId);
    return [
      <FrameHeader key={header.id} workbench={workbench} frame={frame} targetSlot={targetSlot} headerSlot={header} />,
    ];
  });
  const resizableSlots = new Map<string, FrameSlot>();
  const panes: SplitPane[] = contentChildren.map((child) => {
    const resizableSlot = resolveResizableSlot(child);
    if (resizableSlot) resizableSlots.set(child.id, resizableSlot);
    const size = resizableSlot
      ? resolveSlotSize(resizableSlot, workbench.layout.getAreaSize(resizableSlot.id))
      : undefined;
    const collapsible = resizableSlot ? resolveFrameSlotCollapsible(workbench, frame, resizableSlot.id) : false;
    const collapsed = resizableSlot ? !(snapshot.openByAreaId[resizableSlot.id] ?? true) && collapsible : false;
    const primaryMinimum = containsFrameSlot(child, frame.primary) ? (node.direction === "row" ? 320 : 240) : undefined;

    return {
      id: child.id,
      content: (
        <FrameView
          workbench={workbench}
          frame={frame}
          node={child}
          attachedHeaders={attachedHeaders}
          claimedHeaderTargets={nextClaimedHeaderTargets}
        />
      ),
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

  return (
    <Flex direction="column" h="full" minH="0" minW="0" w="full" overflow="hidden">
      {externalHeaders}
      <Flex flex="1" minH="0" minW="0" overflow="hidden">
        {content}
      </Flex>
    </Flex>
  );
};

export const FrameView = (props: FrameViewProps) =>
  props.node.kind === "slot" ? (
    <FrameSlotView {...props} node={props.node} />
  ) : (
    <FrameSplitView {...props} node={props.node} />
  );
