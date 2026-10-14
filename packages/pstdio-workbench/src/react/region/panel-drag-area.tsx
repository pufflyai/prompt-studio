import { Box, type BoxProps } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import type { PanelEdge } from "@pstdio/sdk/extensions";
import { ResourceContextMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import type { MovablePanel } from "../../core/registries/layout/panel-geometry";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export type GeometryDrag = MovablePanel | "activity";
export const panelPositionLabel = (panel: GeometryDrag, edge: PanelEdge) => {
  if (panel === "main" || panel === "secondary") return `Flip Main and Secondary · ${panel} ${edge}`;
  const label = {
    side: "Sidebar",
    sidenav: "Navigation",
    aside: "Page side panel",
    bottom: "Page bottom panel",
    activity: "Action bar",
  }[panel];
  return `${label} ${panel === "sidenav" ? "far " : ""}${edge}`;
};
export const moveGeometry = (workbench: WorkbenchCore, panel: GeometryDrag, edge: PanelEdge) =>
  runUserAction(workbench, panelPositionLabel(panel, edge), () =>
    workbench.commands.executeCommand(
      panel === "activity" ? "workbench.setActionBarPosition" : "workbench.repositionPanel",
      { panel, edge },
    ),
  );
export const geometryPositions = (workbench: WorkbenchCore, panel: GeometryDrag) =>
  (panel === "activity"
    ? (["left", "right", "top", "bottom"] as PanelEdge[])
    : workbench.getPanelPositions(panel)
  ).filter(
    (edge) =>
      edge !==
      (panel === "activity" ? (workbench.layout.getLayout().actionBarEdge ?? "left") : workbench.getPanelEdge(panel)),
  );

interface PanelDragAreaProps extends BoxProps {
  workbench: WorkbenchCore;
  panel: GeometryDrag;
}
const occupied =
  "button,a,input,textarea,select,[role='button'],[role='tab'],[role='menuitem'],[contenteditable='true'],[data-workbench-tab],[data-workbench-breadcrumb]";
export const PanelDragHandle = (props: PanelDragAreaProps) => {
  const { workbench, panel, ...rest } = props;
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const positions = geometryPositions(workbench, panel);
  const drag = useDraggable({ id: `panel:${panel}`, data: { panel }, disabled: !positions.length });
  const empty = (target: EventTarget | null) => target instanceof Element && !target.closest(occupied);
  return (
    <Box
      {...rest}
      ref={drag.setNodeRef}
      data-workbench-panel-drag={panel}
      tabIndex={positions.length ? 0 : undefined}
      aria-label={`${panel} panel placement`}
      onMouseDown={(event) => {
        if (empty(event.target)) drag.listeners?.onMouseDown?.(event);
      }}
      onTouchStart={(event) => {
        if (empty(event.target)) drag.listeners?.onTouchStart?.(event);
      }}
    />
  );
};

export const PanelDragArea = (props: PanelDragAreaProps) => {
  const { workbench, panel } = props;
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  return (
    <ResourceContextMenu
      actions={geometryPositions(workbench, panel).map((edge) => ({
        key: edge,
        label: panelPositionLabel(panel, edge),
        onClick: () => {
          void moveGeometry(workbench, panel, edge);
        },
      }))}
    >
      <PanelDragHandle {...props} />
    </ResourceContextMenu>
  );
};
