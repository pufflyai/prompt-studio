import { Button, HStack, IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import type { MenuPath, WorkbenchCommandExecutionContext, WorkbenchCore } from "../../core";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import { listWorkbenchMenuItemsFromState, type WorkbenchMenuItem } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchHeaderActionsProps {
  workbench: WorkbenchCore;
  menuPath: MenuPath;
}

const isOverflowAction = (item: WorkbenchMenuItem) => item.group === "overflow";
const resolveOverflowLabel = (items: WorkbenchMenuItem[]) =>
  items.find((item) => item.overflowLabel)?.overflowLabel ?? "More header actions";

const commandExecutionContext = (workbench: WorkbenchCore): WorkbenchCommandExecutionContext | undefined => {
  const resource = workbench.getPrimaryResource();
  return resource ? { resource } : undefined;
};

const WorkbenchInlineHeaderAction = (props: {
  item: WorkbenchMenuItem;
  onSelect: (item: WorkbenchMenuItem) => void;
}) => {
  const { item, onSelect } = props;
  const onClick = () => onSelect(item);

  if (item.group === "primary" || !item.icon) {
    return (
      <Button key={item.id} size="xs" variant="subtle" disabled={item.disabled} onClick={onClick}>
        {item.icon ? <WorkbenchIcon name={item.icon} size={14} /> : null}
        {item.label}
      </Button>
    );
  }

  return (
    <Tooltip key={item.id} content={item.label}>
      <IconButton size="xs" variant="ghost" aria-label={item.label} disabled={item.disabled} onClick={onClick}>
        <WorkbenchIcon name={item.icon} size={16} />
      </IconButton>
    </Tooltip>
  );
};

export const WorkbenchHeaderActions = (props: WorkbenchHeaderActionsProps) => {
  const { menuPath, workbench } = props;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const items = listWorkbenchMenuItemsFromState({ itemsByPath, commands, contextValues }, menuPath);
  const inlineItems = items.filter((item) => !isOverflowAction(item));
  const overflowItems = items.filter(isOverflowAction);

  // Actions whose command declares parameters collect that input through the shared
  // command params dialog (opened via the command palette store) before running;
  // parameterless actions execute immediately.
  const onSelect = (item: WorkbenchMenuItem) => {
    const command = commands[item.commandId]?.command;
    const args = item.args;
    const context = commandExecutionContext(workbench);
    if (command && hasCommandParameters(command.params)) {
      workbench.commandPalette.requestParams({ record: { command }, label: item.label, args, context });
      return;
    }
    void workbench.commands.executeCommand(item.commandId, args, context).catch(() => undefined);
  };

  if (items.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {inlineItems.map((item) => (
        <WorkbenchInlineHeaderAction key={item.id} item={item} onSelect={onSelect} />
      ))}
      {overflowItems.length > 0 ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton size="xs" variant="ghost" aria-label={resolveOverflowLabel(overflowItems)}>
              <WorkbenchIcon name="MoreHorizontal" size={16} />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content minW="220px" bg="bg">
                {overflowItems.map((item) => (
                  <Menu.Item key={item.id} value={item.id} asChild>
                    <ListRow
                      asChild
                      variant="compact"
                      id={item.id}
                      label={item.label}
                      icon={item.icon ? <WorkbenchIcon name={item.icon} size={16} /> : undefined}
                      disabled={item.disabled}
                      onActivate={() => onSelect(item)}
                    />
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      ) : null}
    </HStack>
  );
};
