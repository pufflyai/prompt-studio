import { Button, HStack, IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import type { MenuPath, WorkbenchCore } from "../../core";
import { listWorkbenchMenuActionItemsFromState, type WorkbenchMenuActionItem } from "../menus/menu-action-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchHeaderActionsProps {
  workbench: WorkbenchCore;
  menuPath: MenuPath;
}

const isOverflowAction = (item: WorkbenchMenuActionItem) => item.group === "overflow";
const resolveOverflowLabel = (items: WorkbenchMenuActionItem[]) =>
  items.find((item) => item.overflowLabel)?.overflowLabel ?? "More header actions";

const executeAction = (input: { workbench: WorkbenchCore; item: WorkbenchMenuActionItem }) => {
  const { item, workbench } = input;
  void workbench.commands.executeCommand(item.commandId, item.args).catch(() => undefined);
};

const WorkbenchInlineHeaderAction = (props: { item: WorkbenchMenuActionItem; workbench: WorkbenchCore }) => {
  const { item, workbench } = props;
  const onClick = () => executeAction({ workbench, item });

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
  const actionsByPath = useWorkbenchStore(workbench.menus.store, (state) => state.actionsByPath);
  const items = listWorkbenchMenuActionItemsFromState({ actionsByPath, commands, contextValues }, menuPath);
  const inlineItems = items.filter((item) => !isOverflowAction(item));
  const overflowItems = items.filter(isOverflowAction);

  if (items.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {inlineItems.map((item) => (
        <WorkbenchInlineHeaderAction key={item.id} item={item} workbench={workbench} />
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
                      onActivate={() => executeAction({ workbench, item })}
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
