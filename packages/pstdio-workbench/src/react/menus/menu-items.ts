import type { ContextKeyValue, MenuPath, RegisteredCommand, RegisteredMenuItem, WorkbenchCore } from "../../core";
import { matchesContextExpression } from "../../core";
import { byContributionPriority } from "../../core/shared/contributions/metadata";

export interface WorkbenchMenuItem {
  id: string;
  commandId: string;
  label: string;
  icon: string | undefined;
  overflowLabel?: string;
  group: string | undefined;
  args: unknown;
  disabled: boolean;
}

interface WorkbenchMenuItemState {
  itemsByPath: Record<string, RegisteredMenuItem[]>;
  commands: Record<string, RegisteredCommand>;
  contextValues: Record<string, ContextKeyValue>;
}

const menuPathKey = (path: MenuPath) => path.join("/");

export const listWorkbenchMenuItemsFromState = (state: WorkbenchMenuItemState, menuPath: MenuPath) =>
  [...(state.itemsByPath[menuPathKey(menuPath)] ?? [])]
    .sort((left, right) => {
      const leftOrder = left.order ?? 0;
      const rightOrder = right.order ?? 0;
      return leftOrder - rightOrder || byContributionPriority(left, right);
    })
    .filter((action) => matchesContextExpression(state.contextValues, action.when))
    .map((action, index) => {
      const record = state.commands[action.commandId];
      if (!record) return null;

      const args = action.args;
      if (record.handler.isVisible?.(args) === false) return null;

      return {
        id: `${action.commandId}:${index}`,
        commandId: record.command.id,
        label: action.label ?? record.command.label,
        icon: action.icon ?? record.command.icon,
        ...(action.overflowLabel ? { overflowLabel: action.overflowLabel } : {}),
        group: action.group,
        args,
        disabled: record.handler.isEnabled?.(args) === false,
      } satisfies WorkbenchMenuItem;
    })
    .filter((item): item is WorkbenchMenuItem => item !== null);

export const listWorkbenchMenuItems = (workbench: WorkbenchCore, menuPath: MenuPath) =>
  listWorkbenchMenuItemsFromState(
    {
      itemsByPath: workbench.layout.menuStore.getState().itemsByPath,
      commands: workbench.commands.store.getState().commands,
      contextValues: workbench.context.store.getState().values,
    },
    menuPath,
  );
