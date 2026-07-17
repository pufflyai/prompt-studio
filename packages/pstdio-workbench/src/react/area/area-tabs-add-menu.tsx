import { IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import type { RegisteredWidgetContribution, ResourceRef, SlotId, WorkbenchCore } from "../../core";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import type { WorkbenchMenuItem } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface AreaTabsAddMenuProps {
  workbench: WorkbenchCore;
  area: SlotId;
  items: WorkbenchMenuItem[];
  openablePanels: RegisteredWidgetContribution[];
  primary?: ResourceRef;
}

export const AreaTabsAddMenu = (props: AreaTabsAddMenuProps) => {
  const { workbench, area, items, openablePanels, primary } = props;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const itemCount = items.length + openablePanels.length;

  const selectItem = (item: WorkbenchMenuItem) => {
    const command = commands[item.commandId]?.command;
    if (command && hasCommandParameters(command.params)) {
      workbench.commandPalette.requestParams({ record: { command }, label: item.label, args: item.args });
      return;
    }
    void workbench.commands.executeCommand(item.commandId, item.args).catch(() => undefined);
  };

  const openPanel = (panel: RegisteredWidgetContribution) => {
    workbench.layout.openWidget(panel.id, { area, resource: primary });
  };

  if (itemCount === 0) return null;

  if (itemCount === 1) {
    const item = items[0];
    const panel = openablePanels[0];
    const label = item?.label ?? `Add ${panel?.title ?? "panel"}`;

    return (
      <Tooltip content={label}>
        <IconButton
          size="2xs"
          variant="ghost"
          aria-label={label}
          disabled={item?.disabled}
          flexShrink={0}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (item) selectItem(item);
            else if (panel) openPanel(panel);
          }}
        >
          <WorkbenchIcon name={item?.icon ?? "plus"} size={14} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          size="2xs"
          variant="ghost"
          aria-label="Add panel"
          flexShrink={0}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <WorkbenchIcon name="plus" size={14} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="220px" bg="bg">
            {items.map((item) => (
              <Menu.Item key={item.id} value={`command:${item.id}`} asChild>
                <ListRow
                  asChild
                  variant="full-width"
                  label={item.label}
                  icon={item.icon ? <WorkbenchIcon name={item.icon} size={16} /> : undefined}
                  disabled={item.disabled}
                  onActivate={() => selectItem(item)}
                />
              </Menu.Item>
            ))}
            {items.length > 0 && openablePanels.length > 0 ? <Menu.Separator /> : null}
            {openablePanels.map((panel) => (
              <Menu.Item key={panel.id} value={`panel:${panel.id}`} asChild>
                <ListRow
                  asChild
                  variant="full-width"
                  label={panel.title}
                  icon={<WorkbenchIcon name="PanelsTopLeft" size={16} />}
                  onActivate={() => openPanel(panel)}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
