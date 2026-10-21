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
    data: panel ? { panelRegion: region, position: edge } : { region, closed: true, edge },
  });
  const highlighted = panel ? panelDrop === edge : drop?.region === region && drop.panelPosition === edge;
  const vertical = edge === "left" || edge === "right";
  const targetId = panel ? `panel-${edge}` : region;
  return (
    <Box
      ref={setNodeRef}
      data-workbench-edge-drop={panel || highlighted ? targetId : undefined}
      data-workbench-edge-hit={panel ? undefined : region}
      data-workbench-edge-position={edge}
      data-drop-active={highlighted || undefined}
      position={panel ? "relative" : "absolute"}
      {...(panel ? {} : tabEdgeAnchors[edge])}
      flexShrink={0}
      w={vertical ? "12" : "full"}
      h={vertical ? "full" : "12"}
      layerStyle={panel || highlighted ? "panelDropZone" : undefined}
      zIndex={panel ? undefined : "overlay"}
    />
  );
};

interface WorkbenchPanelDropFrameProps {
  workbench: WorkbenchCore;
  region: Exclude<WorkbenchPositionedRegion, "main">;
  children: ReactNode;
}

/** Panel moves reserve space; tab targets overlay their stable layout boundary. */
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
  ) {
    edges = workbench.shell.getPanelPositions(region);
    if (!edges.length) edges = [arrangement[region]];
  }

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
