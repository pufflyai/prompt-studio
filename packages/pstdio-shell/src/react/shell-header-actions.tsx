import { Button, HStack, IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import type { MenuPath, ShellCore } from "../core";
import { ShellIcon } from "./shell-icons";
import { listShellMenuActionItems, type ShellMenuActionItem } from "./shell-menu-action-items";

interface ShellHeaderActionsProps {
  shell: ShellCore;
  menuPath: MenuPath;
  refresh: () => void;
  onCommandError?: (error: unknown) => void;
}

const isOverflowAction = (item: ShellMenuActionItem) => item.group === "overflow";

const executeAction = (input: {
  shell: ShellCore;
  item: ShellMenuActionItem;
  refresh: () => void;
  onCommandError?: (error: unknown) => void;
}) => {
  const { item, onCommandError, refresh, shell } = input;

  void shell.commands
    .executeCommand(item.commandId, item.args)
    .then(refresh)
    .catch((error) => onCommandError?.(error));
};

const ShellInlineHeaderAction = (props: {
  item: ShellMenuActionItem;
  shell: ShellCore;
  refresh: () => void;
  onCommandError?: (error: unknown) => void;
}) => {
  const { item, onCommandError, refresh, shell } = props;
  const onClick = () => executeAction({ shell, item, refresh, onCommandError });

  if (item.group === "primary" || !item.icon) {
    return (
      <Button key={item.id} size="xs" variant="subtle" disabled={item.disabled} onClick={onClick}>
        {item.icon ? <ShellIcon name={item.icon} size={14} /> : null}
        {item.label}
      </Button>
    );
  }

  return (
    <Tooltip key={item.id} content={item.label}>
      <IconButton size="xs" variant="ghost" aria-label={item.label} disabled={item.disabled} onClick={onClick}>
        <ShellIcon name={item.icon} size={16} />
      </IconButton>
    </Tooltip>
  );
};

export const ShellHeaderActions = (props: ShellHeaderActionsProps) => {
  const { menuPath, onCommandError, refresh, shell } = props;
  const items = listShellMenuActionItems(shell, menuPath);
  const inlineItems = items.filter((item) => !isOverflowAction(item));
  const overflowItems = items.filter(isOverflowAction);

  if (items.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {inlineItems.map((item) => (
        <ShellInlineHeaderAction
          key={item.id}
          item={item}
          shell={shell}
          refresh={refresh}
          onCommandError={onCommandError}
        />
      ))}
      {overflowItems.length > 0 ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton size="xs" variant="ghost" aria-label="More header actions">
              <ShellIcon name="MoreHorizontal" size={16} />
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
                      icon={item.icon ? <ShellIcon name={item.icon} size={16} /> : undefined}
                      disabled={item.disabled}
                      onActivate={() => executeAction({ shell, item, refresh, onCommandError })}
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
