import { Box } from "@chakra-ui/react";
import { useDroppable } from "@dnd-kit/core";
import { DropIndicator } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import type { WorkbenchPanelPosition, WorkbenchPositionedRegion } from "../../core/registries/layout/panel-positions";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useTabDrag } from "./tab-drag-context";

const EdgeTarget = (props: {
  edge: WorkbenchPanelPosition;
  region: WorkbenchPanelRegion | WorkbenchPositionedRegion;
  panel?: boolean;
}) => {
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
      position="absolute"
      zIndex="popover"
      top={edge === "bottom" ? undefined : "0"}
      bottom={edge === "top" ? undefined : "0"}
      left={edge === "right" ? undefined : "0"}
      right={edge === "left" ? undefined : "0"}
      w={vertical ? "12" : undefined}
      h={vertical ? undefined : "12"}
      layerStyle="tabDropZone"
    >
      {highlighted ? <DropIndicator orientation="vertical" /> : null}
    </Box>
  );
};

export const WorkbenchPanelEdgeTargets = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const { activeId, destinations, activePanel } = useTabDrag();
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const arrangement = workbench.shell.getArrangement();
  if (activePanel)
    return workbench.shell
      .getPanelPositions(activePanel)
      .map((edge) => <EdgeTarget key={edge} edge={edge} region={activePanel} panel />);
  if (!activeId) return null;
  return (["side", "secondary"] as const)
    .filter((region) => destinations?.includes(region) && !workbench.shell.getPanelPolicy(region).open)
    .map((region) => <EdgeTarget key={region} region={region} edge={arrangement[region]} />);
};
