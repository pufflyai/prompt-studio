import { Box, Flex } from "@chakra-ui/react";
import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import {
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

const PanelInsertionTarget = (props: PanelInsertionTargetProps) => {
  const { edge, region, panel } = props;
  const { drop, panelDrop } = useTabDrag();
  const { setNodeRef } = useDroppable({
    id: `edge:${panel ? "panel" : "tab"}:${region}:${edge}`,
    data: panel ? { panelRegion: region, position: edge } : { region, closed: true },
  });
  const highlighted = panel ? panelDrop === edge : drop?.region === region;
  const vertical = edge === "left" || edge === "right";
  return (
    <Box
      ref={setNodeRef}
      data-workbench-edge-drop={panel ? `panel-${edge}` : region}
      data-drop-active={highlighted || undefined}
      position="relative"
      flexShrink={0}
      w={vertical ? "12" : "full"}
      h={vertical ? "full" : "12"}
      layerStyle="panelDropZone"
    />
  );
};

interface WorkbenchPanelDropFrameProps {
  workbench: WorkbenchCore;
  region: Exclude<WorkbenchPositionedRegion, "main">;
  children: ReactNode;
}

/** Insert targets at the layout boundary that owns the placement, so they reserve real space. */
export const WorkbenchPanelDropFrame = (props: WorkbenchPanelDropFrameProps) => {
  const { workbench, region, children } = props;
  const { activeId, destinations, activePanel } = useTabDrag();
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const arrangement = workbench.shell.getArrangement();
  const moving = region === "secondary" && activePanel === "main" ? "main" : region;
  const current = resolvePanelPosition(arrangement, moving);
  let edges: readonly WorkbenchPanelPosition[] = [];
  if (activePanel === moving) edges = workbench.shell.getPanelPositions(moving).filter((edge) => edge !== current);
  else if (
    !activePanel &&
    activeId &&
    (region === "side" || region === "secondary") &&
    destinations?.includes(region) &&
    !workbench.shell.getPanelPolicy(region).open
  )
    edges = [arrangement[region]];

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
