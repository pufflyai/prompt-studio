import { HStack, Text } from "@chakra-ui/react";
import { PaletteShortcut, type TreeListAction, type TreeListActionMenuItem } from "@pstdio/ui";
import type { MenuPath, ShellCore, TreeAction } from "../../core";
import { ShellIcon } from "../shared/icon";

interface CreateTreeActionItemsInput {
  actions?: TreeAction[];
  shell: ShellCore;
  onCommandError?: (error: unknown) => void;
}

interface CreateTreeMenuItemsInput {
  shell: ShellCore;
  menuPath: MenuPath;
  onCommandError?: (error: unknown) => void;
}

interface CreateTreeContextMenuItemsInput {
  actions?: TreeAction[];
  menuPath?: MenuPath;
  shell: ShellCore;
  onCommandError?: (error: unknown) => void;
}

const executeTreeAction = (input: {
  action: TreeAction;
  shell: ShellCore;
  onCommandError?: (error: unknown) => void;
}) => {
  const { action, onCommandError, shell } = input;
  const record = action.commandId ? shell.commands.getCommand(action.commandId) : undefined;
  const result = record ? shell.commands.executeCommand(record.command.id, action.args) : action.run?.();

  void Promise.resolve(result).catch((error) => onCommandError?.(error));
};

const resolveTreeActionCommand = (shell: ShellCore, action: TreeAction) => {
  if (!action.commandId) return undefined;
  return shell.commands.getCommand(action.commandId);
};

const isTreeActionVisible = (shell: ShellCore, action: TreeAction) => {
  if (!shell.context.matches(action.when)) return false;

  const record = resolveTreeActionCommand(shell, action);
  if (action.commandId && !record) return false;

  return record ? shell.commands.isCommandVisible(record.command.id, action.args) : true;
};

const isTreeActionEnabled = (shell: ShellCore, action: TreeAction) => {
  if (action.disabled) return false;

  const record = resolveTreeActionCommand(shell, action);
  return record ? shell.commands.isCommandEnabled(record.command.id, action.args) : true;
};

export const createTreeMenuItems = (input: CreateTreeMenuItemsInput) => {
  const { menuPath, onCommandError, shell } = input;
  const shortcuts = new Map(shell.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListActionMenuItem[] = [];

  for (const [index, action] of shell.menus.listMenuActions(menuPath).entries()) {
    if (!shell.context.matches(action.when)) continue;

    const record = shell.commands.getCommand(action.commandId);
    if (!record) continue;

    const args = action.args;
    if (!shell.commands.isCommandVisible(record.command.id, args)) continue;

    const icon = action.icon ?? record.command.icon;
    const binding = shortcuts.get(record.command.id);
    items.push({
      id: `${action.commandId}:${index}`,
      label: action.label ?? record.command.label,
      icon: icon ? <ShellIcon name={icon} /> : undefined,
      endContent: binding ? <PaletteShortcut binding={binding} /> : undefined,
      disabled: !shell.commands.isCommandEnabled(record.command.id, args),
      onAction: () => {
        void shell.commands.executeCommand(record.command.id, args).catch((error) => onCommandError?.(error));
      },
    });
  }

  return items;
};

const createTreeActionMenuItems = (input: CreateTreeContextMenuItemsInput) => {
  const { actions = [], onCommandError, shell } = input;
  const shortcuts = new Map(shell.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListActionMenuItem[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(shell, action)) continue;

    const record = resolveTreeActionCommand(shell, action);
    const label = action.label ?? record?.command.label;
    if (!label) continue;

    const icon = action.icon ?? record?.command.icon;
    const disabled = !isTreeActionEnabled(shell, action);
    const binding = action.commandId ? shortcuts.get(action.commandId) : undefined;
    items.push({
      id: action.id,
      label,
      icon: icon ? <ShellIcon name={icon} /> : undefined,
      endContent: binding ? <PaletteShortcut binding={binding} /> : undefined,
      disabled,
      onAction: () => {
        if (disabled) return;
        executeTreeAction({ action, shell, onCommandError });
      },
    });
  }

  return items;
};

export const createTreeContextMenuItems = (input: CreateTreeContextMenuItemsInput) => [
  ...(input.menuPath ? createTreeMenuItems({ ...input, menuPath: input.menuPath }) : []),
  ...createTreeActionMenuItems(input),
];

export const createTreeActionItems = (input: CreateTreeActionItemsInput) => {
  const { actions = [], onCommandError, shell } = input;
  const shortcuts = new Map(shell.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListAction[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(shell, action) || !isTreeActionEnabled(shell, action)) continue;

    const record = resolveTreeActionCommand(shell, action);
    const label = action.label ?? record?.command.label;
    if (!label) continue;

    const icon = action.icon ?? record?.command.icon;
    const binding = action.commandId ? shortcuts.get(action.commandId) : undefined;
    items.push({
      id: action.id,
      label,
      icon: icon ? <ShellIcon name={icon} /> : undefined,
      tooltip: binding ? (
        <HStack gap="2">
          <Text>{label}</Text>
          <PaletteShortcut binding={binding} />
        </HStack>
      ) : undefined,
      onAction: () => {
        executeTreeAction({ action, shell, onCommandError });
      },
    });
  }

  return items;
};
