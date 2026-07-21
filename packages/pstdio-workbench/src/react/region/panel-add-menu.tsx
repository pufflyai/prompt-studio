import { IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { useRef } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { listEligibleSubPanels } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { openPanelWidget } from "./panel-widget-open";

interface WorkbenchPanelAddMenuProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
}

export const WorkbenchPanelAddMenu = (props: WorkbenchPanelAddMenuProps) => {
  const { region, workbench } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const label = "Add panel";
  const widgets = listEligibleSubPanels({
    widgets: Object.values(layoutState.widgets),
    layout: layoutState.layout,
    region,
    resource,
    modeId,
  });
  if (widgets.length === 0) return null;

  return (
    <Menu.Root positioning={{ placement: "bottom-start", getAnchorElement: () => triggerRef.current }}>
      <Tooltip content={label}>
        <Menu.Trigger asChild>
          <IconButton
            ref={triggerRef}
            size={PANEL_HEADER_CONTROL_SIZE}
            variant="ghost"
            aria-label={label}
            flexShrink={0}
          >
            <WorkbenchIcon name="plus" size={13} />
          </IconButton>
        </Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={label} minW="17.5rem" bg="bg">
            {widgets.map((widget) => (
              <Menu.Item key={widget.id} value={`widget:${widget.id}`} asChild>
                <ListRow
                  asChild
                  variant="full-width"
                  label={widget.title}
                  icon={widget.icon ? <WorkbenchIcon name={widget.icon} size={14} /> : undefined}
                  onActivate={() => openPanelWidget({ workbench, widget, region, resource })}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
