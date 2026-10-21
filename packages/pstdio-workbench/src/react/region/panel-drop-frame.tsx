import { Box, Flex } from "@chakra-ui/react";
import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { WorkbenchCore } from "../../core";
import {
  resolveArrangement,
  resolvePanelPosition,
  type WorkbenchPanelPosition,
  type WorkbenchPositionedRegion,
} from "../../core/registries/layout/panel-positions";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useTabDrag } from "./tab-drag-context";

interface PanelInsertionTargetProps {
  edge: WorkbenchPanelPosition;
  region: WorkbenchPositionedRegion;
  panel: boolean;
}

const tabEdgeAnchors = {
  left: { top: "0", bottom: "0", left: "0" },
  right: { top: "0", bottom: "0", right: "0" },
  top: { top: "0", left: "0", right: "0" },
  bottom: { bottom: "0", left: "0", right: "0" },
} as const;

const PanelInsertionTarget = (props: PanelInsertionTargetProps) => {
  const { edge, region, panel } = props;
  const { drop, panelDrop } = useTabDrag();
  const { setNodeRef } = useDroppable({
    id: `edge:${panel ? "panel" : "tab"}:${region}:${edge}`,
    data: panel ? { panelRegion: region, position: edge } : { region, panelPosition: edge },
  });
  const highlighted = panel ? panelDrop === edge : drop?.region === region && drop.panelPosition === edge;
  const vertical = edge === "left" || edge === "right";
  const targetId = panel ? `panel-${edge}` : region;
  return (
    <>
      {!panel ? (
        <Box
          ref={setNodeRef}
          data-workbench-edge-hit={region}
          data-workbench-edge-position={edge}
          position="absolute"
          {...tabEdgeAnchors[edge]}
          w={vertical ? "12" : "full"}
          h={vertical ? "full" : "12"}
          zIndex="overlay"
        />
      ) : null}
      {panel || highlighted ? (
        <Box
          ref={panel ? setNodeRef : undefined}
          data-workbench-edge-drop={targetId}
          data-workbench-edge-position={edge}
          data-drop-active={highlighted || undefined}
          position="relative"
          flexShrink={0}
          w={vertical ? "12" : "full"}
          h={vertical ? "full" : "12"}
          layerStyle="panelDropZone"
        />
      ) : null}
    </>
  );
};

interface WorkbenchPanelDropFrameProps {
  workbench: WorkbenchCore;
  region: Exclude<WorkbenchPositionedRegion, "main">;
  children: ReactNode;
}

/** Visible targets reserve space at the layout boundary that owns the panel. */
export const WorkbenchPanelDropFrame = (props: WorkbenchPanelDropFrameProps) => {
  const { workbench, region, children } = props;
  const { activeId, destinations, activePanel } = useTabDrag();
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const moving = region === "secondary" && activePanel === "main" ? "main" : region;
  // Derive from the subscribed layout so a completed move updates the next drag.
  const edges = useWorkbenchStore(
    workbench.layout.store,
    useShallow((state) => {
      const arrangement = resolveArrangement(state.layout.arrangement);
      const current = resolvePanelPosition(arrangement, moving);
      if (activePanel === moving) return workbench.shell.getPanelPositions(moving).filter((edge) => edge !== current);
      if (!activePanel && activeId && (region === "side" || region === "secondary") && destinations?.includes(region)) {
        const open = workbench.shell.getPanelPolicy(region).open;
        const widgets = state.layout.regions[region].widgets;
        const lastTab = widgets.length === 1 && widgets[0]?.widgetId === activeId;
        const positions = workbench.shell.getPanelPositions(region);
        if (!open) return positions.length ? positions : [arrangement[region]];
        if (lastTab) return positions.filter((edge) => edge !== current);
      }
      return [];
    }),
  );

  const targets = Object.fromEntries(
    edges.map((edge) => [
      edge,
      <PanelInsertionTarget key={edge} edge={edge} region={moving} panel={Boolean(activePanel)} />,
    ]),
  );
  return (
    <Flex
      data-workbench-panel-drop-frame={region}
      position="relative"
      direction="column"
      flex="1"
      h="full"
      minH="0"
      minW="0"
      w="full"
    >
      {targets.top}
      <Flex flex="1" minH="0" minW="0">
        {targets.left}
        <Flex flex="1" minH="0" minW="0" position="relative">
          {children}
        </Flex>
        {targets.right}
      </Flex>
      {targets.bottom}
      {region === "activity" && activePanel ? (
        // Keep pointer movement and release in the host, including over Navigation and other iframe views.
        <Box
          data-workbench-panel-drag-shield=""
          aria-hidden
          layerStyle="panelDragging"
          position="absolute"
          inset="0"
          zIndex="overlay"
        />
      ) : null}
    </Flex>
  );
};
