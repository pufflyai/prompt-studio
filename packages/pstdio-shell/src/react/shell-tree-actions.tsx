import type { TreeListAction, TreeListActionMenuItem } from "@pstdio/ui";
import type { MenuPath, ShellCore, TreeAction } from "../core";
import { ShellIcon } from "./shell-icons";

interface CreateTreeActionItemsInput {
  actions?: TreeAction[];
  shell: ShellCore;
  refresh: () => void;
  onCommandError?: (error: unknown) => void;
}

interface CreateTreeMenuItemsInput {
  shell: ShellCore;
  menuPath: MenuPath;
  refresh: () => void;
  onCommandError?: (error: unknown) => void;
}

const executeTreeAction = (input: {
  action: TreeAction;
  refresh: () => void;
  shell: ShellCore;
  onCommandError?: (error: unknown) => void;
}) => {
  const { action, onCommandError, refresh, shell } = input;
  const record = action.commandId ? shell.commands.getCommand(action.commandId) : undefined;
  const result = record ? shell.commands.executeCommand(record.command.id, action.args) : action.run?.();

  void Promise.resolve(result)
    .then(refresh)
    .catch((error) => onCommandError?.(error));
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
  const { menuPath, onCommandError, refresh, shell } = input;
  const items: TreeListActionMenuItem[] = [];

  for (const [index, action] of shell.menus.listMenuActions(menuPath).entries()) {
    if (!shell.context.matches(action.when)) continue;

    const record = shell.commands.getCommand(action.commandId);
    if (!record) continue;

    const args = action.args;
    if (!shell.commands.isCommandVisible(record.command.id, args)) continue;

    const icon = action.icon ?? record.command.icon;
    items.push({
      id: `${action.commandId}:${index}`,
      label: action.label ?? record.command.label,
      icon: icon ? <ShellIcon name={icon} /> : undefined,
      disabled: !shell.commands.isCommandEnabled(record.command.id, args),
      onAction: () => {
        void shell.commands
          .executeCommand(record.command.id, args)
          .then(refresh)
          .catch((error) => onCommandError?.(error));
      },
    });
  }

  return items;
};

export const createTreeActionItems = (input: CreateTreeActionItemsInput) => {
  const { actions = [], onCommandError, refresh, shell } = input;
  const items: TreeListAction[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(shell, action) || !isTreeActionEnabled(shell, action)) continue;

    const record = resolveTreeActionCommand(shell, action);
    const label = action.label ?? record?.command.label;
    if (!label) continue;

    const icon = action.icon ?? record?.command.icon;
    items.push({
      id: action.id,
      label,
      icon: icon ? <ShellIcon name={icon} /> : undefined,
      onAction: () => {
        executeTreeAction({ action, shell, refresh, onCommandError });
      },
    });
  }

  return items;
};
