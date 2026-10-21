import { mergeRefs } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { Header } from "@pstdio/ui";
import type { ComponentProps, MouseEvent, TouchEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import type { WorkbenchCore } from "../../core";
import { resolvePanelPosition, type WorkbenchPositionedRegion } from "../../core/registries/layout/panel-positions";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const usePanelMovePositions = (workbench: WorkbenchCore, region: WorkbenchPositionedRegion) => {
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  return useWorkbenchStore(
    workbench.layout.store,
    useShallow(() => {
      const current = resolvePanelPosition(workbench.shell.getArrangement(), region);
      return workbench.shell.getPanelPositions(region).filter((position) => position !== current);
    }),
  );
};

export const usePanelPositionActions = (workbench: WorkbenchCore, region: WorkbenchPositionedRegion) => {
  return usePanelMovePositions(workbench, region).map((position) => ({
    key: `position-${position}`,
    label: `Move ${region === "activity" ? "action bar" : "panel"} to ${position}`,
    icon: (
      <WorkbenchIcon
        name={{ left: "PanelLeft", right: "PanelRight", top: "PanelTop", bottom: "PanelBottom" }[position]}
        size={14}
      />
    ),
    onClick: () => workbench.shell.repositionPanel(region, position),
  }));
};

const interactive =
  'button,a,input,textarea,select,iframe,[role="tab"],[role="treeitem"],[role="button"],[role="menuitem"],[contenteditable="true"],[data-workbench-tab]';

/** Only unused header space starts a whole-panel drag. Tab and control gestures keep their owners. */
export const usePanelDragSurface = (workbench: WorkbenchCore, region: WorkbenchPositionedRegion) => {
  const canMove = usePanelMovePositions(workbench, region).length > 0;
  const floatingSide = useWorkbenchStore(
    workbench.layout.store,
    () => region === "side" && workbench.sidePanel.getMode() === "floating",
  );
  const fullscreenSide = useWorkbenchStore(workbench.fullscreen.store, (state) => region === "side" && state.active);
  const disabled = !canMove || floatingSide || fullscreenSide;
  const drag = useDraggable({
    id: `panel:${region}`,
    data: { panelRegion: region },
    disabled,
  });
  const empty = (event: MouseEvent | TouchEvent) => !(event.target as Element).closest(interactive);
  return {
    ref: drag.setNodeRef,
    tabIndex: 0,
    "aria-label": `Move ${region} panel`,
    "data-workbench-panel-drag": region,
    "data-panel-draggable": !disabled || undefined,
    "data-panel-dragging": drag.isDragging || undefined,
    layerStyle: "panelDragSurface",
    onMouseDown: (event: MouseEvent<HTMLElement>) => {
      if (empty(event)) drag.listeners?.onMouseDown?.(event);
    },
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      if (empty(event)) drag.listeners?.onTouchStart?.(event);
    },
  };
};

interface PanelDragHeaderProps extends ComponentProps<typeof Header> {
  workbench: WorkbenchCore;
  region: WorkbenchPositionedRegion;
}
export const PanelDragHeader = (props: PanelDragHeaderProps) => {
  const { workbench, region, children, ref, ...rest } = props;
  const drag = usePanelDragSurface(workbench, region);
  return (
    <Header {...drag} {...rest} ref={mergeRefs(drag.ref, ref)}>
      {children}
    </Header>
  );
};
