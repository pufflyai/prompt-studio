import { IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { useRef } from "react";
import type { RegisteredWidgetContribution, ResourceRef, WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { openPanelWidget } from "./panel-widget-open";

interface WorkbenchPanelAddMenuProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
  resource?: ResourceRef;
  widgets: RegisteredWidgetContribution[];
}

export const WorkbenchPanelAddMenu = (props: WorkbenchPanelAddMenuProps) => {
  const { region, resource, widgets, workbench } = props;
  const hydrating = useWorkbenchStore(workbench.history.store, (state) => state.hydrating);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = "Add panel";
  if (widgets.length === 0) return null;

  const trigger = (
    <IconButton
      ref={widgets.length > 1 ? triggerRef : undefined}
      size={PANEL_HEADER_CONTROL_SIZE}
      variant="ghost"
      aria-label={label}
      disabled={hydrating}
      flexShrink={0}
      onClick={
        widgets.length === 1 ? () => openPanelWidget({ workbench, widget: widgets[0], region, resource }) : undefined
      }
    >
      <WorkbenchIcon name="plus" size={13} />
    </IconButton>
  );

  if (widgets.length === 1) return <Tooltip content={label}>{trigger}</Tooltip>;

  return (
    <Menu.Root positioning={{ placement: "bottom-start", getAnchorElement: () => triggerRef.current }}>
      <Tooltip content={label}>
        <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={label} minW="17.5rem" bg="bg">
            {widgets.map((widget) => (
              <Menu.Item key={widget.id} value={`widget:${widget.id}`} disabled={hydrating} asChild>
                <ListRow
                  asChild
                  variant="full-width"
                  label={widget.title}
                  icon={widget.icon ? <WorkbenchIcon name={widget.icon} size={14} /> : undefined}
                  disabled={hydrating}
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
