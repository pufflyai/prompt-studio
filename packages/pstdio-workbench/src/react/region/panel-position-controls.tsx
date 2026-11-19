import { mergeRefs } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { Header } from "@pstdio/ui";
import type { ComponentProps, MouseEvent, TouchEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import type { WorkbenchCore } from "../../core";
import { resolvePanelPosition, type WorkbenchPositionedRegion } from "../../core/registries/layout/panel-positions";
import { resolvePageContent } from "../../core/registries/pages/page-content";
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
  const content = useWorkbenchStore(workbench.pages.store, (state) =>
    region === "main" ? resolvePageContent(state) : undefined,
  );
  const positions = usePanelMovePositions(workbench, region);
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  if (content)
    return workbench.getPanelDestinations(content.widgetId).map((destination) => ({
      key: `move-view-${destination}`,
      label: `Move to ${destination === "side" ? "Side" : "Bottom"}`,
      icon: <WorkbenchIcon name={destination === "side" ? "PanelRight" : "PanelBottom"} size={14} />,
      onClick: () => workbench.movePanel(content.widgetId, destination),
    }));
  return positions.map((position) => ({
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
  'button,a,input,textarea,select,iframe,[role="tab"],[role="treeitem"],[role="button"],[role="menuitem"],[contenteditable="true"],[data-workbench-tab],[data-tree-list-focus-id]';

/** Only unused header space starts a whole-panel drag. Tab and control gestures keep their owners. */
export const usePanelDragSurface = (workbench: WorkbenchCore, region: WorkbenchPositionedRegion) => {
  const positions = usePanelMovePositions(workbench, region);
  const content = useWorkbenchStore(workbench.pages.store, (state) =>
    region === "main" ? resolvePageContent(state) : undefined,
  );
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const canMove = content ? workbench.getPanelDestinations(content.widgetId).length > 0 : positions.length > 0;
  const floatingSide = useWorkbenchStore(
    workbench.layout.store,
    () => region === "side" && workbench.sidePanel.getMode() === "floating",
  );
  const fullscreenPanel = useWorkbenchStore(
    workbench.fullscreen.store,
    (state) => (region === "side" || region === "main") && state.active,
  );
  const disabled = !canMove || floatingSide || fullscreenPanel;
  const drag = useDraggable({
    id: content?.widgetId ?? `panel:${region}`,
    data: content ? { pageContent: true } : { panelRegion: region },
    disabled,
  });
  const empty = (event: MouseEvent | TouchEvent) => !(event.target as Element).closest(interactive);
  return {
    ref: drag.setNodeRef,
    tabIndex: 0,
    "aria-label": `Move ${region} panel`,
    "data-workbench-panel-drag": region,
    "data-workbench-page-drag": content?.widgetId,
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
