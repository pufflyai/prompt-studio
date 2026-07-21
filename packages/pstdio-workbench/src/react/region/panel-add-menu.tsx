import { IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { listEligiblePanelWidgets, workbenchRegionTabAddMenuPath } from "../../core";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import { listWorkbenchMenuItemsFromState, type WorkbenchMenuItem } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { openPanelWidget } from "./panel-widget-open";

interface WorkbenchPanelAddMenuProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
}

const selectCommand = (workbench: WorkbenchCore, item: WorkbenchMenuItem) => {
  const command = workbench.commands.getCommand(item.commandId)?.command;
  if (command && hasCommandParameters(command.params)) {
    workbench.commandPalette.requestParams({ record: { command }, label: item.label, args: item.args });
    return;
  }
  void workbench.commands.executeCommand(item.commandId, item.args).catch(() => undefined);
};

export const WorkbenchPanelAddMenu = (props: WorkbenchPanelAddMenuProps) => {
  const { region, workbench } = props;
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const resource = workbench.getPrimaryResource();
  const label = "Add panel";
  const widgets = listEligiblePanelWidgets({
    widgets: Object.values(layoutState.widgets),
    layout: layoutState.layout,
    region,
    resource,
  });
  const commandItems = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchRegionTabAddMenuPath(region),
    { resource },
  ).filter((item) => !widgets.some((widget) => widget.openCommandId === item.commandId));

  return (
    <Menu.Root positioning={{ placement: "bottom-start" }}>
      <Tooltip content={label}>
        <Menu.Trigger asChild>
          <IconButton size={PANEL_HEADER_CONTROL_SIZE} variant="ghost" aria-label={label} flexShrink={0}>
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
            {commandItems.map((item) => (
              <Menu.Item key={item.id} value={`command:${item.id}`} disabled={item.disabled} asChild>
                <ListRow
                  asChild
                  variant="full-width"
                  label={item.label}
                  icon={item.icon ? <WorkbenchIcon name={item.icon} size={14} /> : undefined}
                  disabled={item.disabled}
                  onActivate={() => selectCommand(workbench, item)}
                />
              </Menu.Item>
            ))}
            {widgets.length === 0 && commandItems.length === 0 ? (
              <Menu.Item value="empty" disabled asChild>
                <ListRow asChild variant="full-width" label="No panels available" disabled />
              </Menu.Item>
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
