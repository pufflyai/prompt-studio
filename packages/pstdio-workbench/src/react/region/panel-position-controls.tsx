import { mergeRefs } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { Header } from "@pstdio/ui";
import type { ComponentProps, MouseEvent, TouchEvent } from "react";
import type { WorkbenchCore } from "../../core";
import type { WorkbenchPositionedRegion } from "../../core/registries/layout/panel-positions";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";

export const panelPositionActions = (workbench: WorkbenchCore, region: WorkbenchPositionedRegion) =>
  workbench.shell.getPanelPositions(region).map((position) => ({
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

const interactive =
  'button,a,input,textarea,select,iframe,[role="tab"],[role="treeitem"],[role="button"],[role="menuitem"],[contenteditable="true"],[data-workbench-tab]';

/** Only unused header space starts a whole-panel drag. Tab and control gestures keep their owners. */
export const usePanelDragSurface = (workbench: WorkbenchCore, region: WorkbenchPositionedRegion) => {
  const policy = usePanelPolicy(workbench, region);
  const drag = useDraggable({
    id: `panel:${region}`,
    data: { panelRegion: region },
    disabled: !policy.movable || !workbench.shell.getPanelPositions(region).length,
  });
  const empty = (event: MouseEvent | TouchEvent) => !(event.target as Element).closest(interactive);
  return {
    ref: drag.setNodeRef,
    tabIndex: 0,
    "aria-label": `Move ${region} panel`,
    "data-workbench-panel-drag": region,
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
