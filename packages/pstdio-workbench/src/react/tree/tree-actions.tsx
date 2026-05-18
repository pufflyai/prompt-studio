import { HStack, Text } from "@chakra-ui/react";
import { PaletteShortcut, type TreeListAction, type TreeListActionMenuItem } from "@pstdio/ui";
import type { MenuPath, TreeAction, WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";

interface CreateTreeActionItemsInput {
  actions?: TreeAction[];
  workbench: WorkbenchCore;
  onCommandError?: (error: unknown) => void;
}

interface CreateTreeMenuItemsInput {
  workbench: WorkbenchCore;
  menuPath: MenuPath;
  onCommandError?: (error: unknown) => void;
}

interface CreateTreeContextMenuItemsInput {
  actions?: TreeAction[];
  menuPath?: MenuPath;
  workbench: WorkbenchCore;
  onCommandError?: (error: unknown) => void;
}

const executeTreeAction = (input: {
  action: TreeAction;
  workbench: WorkbenchCore;
  onCommandError?: (error: unknown) => void;
}) => {
  const { action, onCommandError, workbench } = input;
  const record = action.commandId ? workbench.commands.getCommand(action.commandId) : undefined;
  const result = record ? workbench.commands.executeCommand(record.command.id, action.args) : action.run?.();

  void Promise.resolve(result).catch((error) => onCommandError?.(error));
};

const resolveTreeActionCommand = (workbench: WorkbenchCore, action: TreeAction) => {
  if (!action.commandId) return undefined;
  return workbench.commands.getCommand(action.commandId);
};

const isTreeActionVisible = (workbench: WorkbenchCore, action: TreeAction) => {
  if (!workbench.context.matches(action.when)) return false;

  const record = resolveTreeActionCommand(workbench, action);
  if (action.commandId && !record) return false;

  return record ? workbench.commands.isCommandVisible(record.command.id, action.args) : true;
};

const isTreeActionEnabled = (workbench: WorkbenchCore, action: TreeAction) => {
  if (action.disabled) return false;

  const record = resolveTreeActionCommand(workbench, action);
  return record ? workbench.commands.isCommandEnabled(record.command.id, action.args) : true;
};

export const createTreeMenuItems = (input: CreateTreeMenuItemsInput) => {
  const { menuPath, onCommandError, workbench } = input;
  const shortcuts = new Map(workbench.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListActionMenuItem[] = [];

  for (const [index, action] of workbench.layout.listMenuItems(menuPath).entries()) {
    if (!workbench.context.matches(action.when)) continue;

    const record = workbench.commands.getCommand(action.commandId);
    if (!record) continue;

    const args = action.args;
    if (!workbench.commands.isCommandVisible(record.command.id, args)) continue;

    const icon = action.icon ?? record.command.icon;
    const binding = shortcuts.get(record.command.id);
    items.push({
      id: `${action.commandId}:${index}`,
      label: action.label ?? record.command.label,
      icon: icon ? <WorkbenchIcon name={icon} /> : undefined,
      endContent: binding ? <PaletteShortcut binding={binding} /> : undefined,
      disabled: !workbench.commands.isCommandEnabled(record.command.id, args),
      onAction: () => {
        void workbench.commands.executeCommand(record.command.id, args).catch((error) => onCommandError?.(error));
      },
    });
  }

  return items;
};

const createTreeActionMenuItems = (input: CreateTreeContextMenuItemsInput) => {
  const { actions = [], onCommandError, workbench } = input;
  const shortcuts = new Map(workbench.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListActionMenuItem[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(workbench, action)) continue;

    const record = resolveTreeActionCommand(workbench, action);
    const label = action.label ?? record?.command.label;
    if (!label) continue;

    const icon = action.icon ?? record?.command.icon;
    const disabled = !isTreeActionEnabled(workbench, action);
    const binding = action.commandId ? shortcuts.get(action.commandId) : undefined;
    items.push({
      id: action.id,
      label,
      icon: icon ? <WorkbenchIcon name={icon} /> : undefined,
      endContent: binding ? <PaletteShortcut binding={binding} /> : undefined,
      disabled,
      onAction: () => {
        if (disabled) return;
        executeTreeAction({ action, workbench, onCommandError });
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
  const { actions = [], onCommandError, workbench } = input;
  const shortcuts = new Map(workbench.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListAction[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(workbench, action) || !isTreeActionEnabled(workbench, action)) continue;

    const record = resolveTreeActionCommand(workbench, action);
    const label = action.label ?? record?.command.label;
    if (!label) continue;

    const icon = action.icon ?? record?.command.icon;
    const binding = action.commandId ? shortcuts.get(action.commandId) : undefined;
    items.push({
      id: action.id,
      label,
      icon: icon ? <WorkbenchIcon name={icon} /> : undefined,
      tooltip: binding ? (
        <HStack gap="2">
          <Text>{label}</Text>
          <PaletteShortcut binding={binding} />
        </HStack>
      ) : undefined,
      onAction: () => {
        executeTreeAction({ action, workbench, onCommandError });
      },
    });
  }

  return items;
};
