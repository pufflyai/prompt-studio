import type {
  ContextKeyValue,
  MenuPath,
  RegisteredCommand,
  RegisteredMenuItem,
  ResourceRef,
  WorkbenchCore,
} from "../../core";
import { scopeWorkbenchResourceContextValues } from "../../core";
import { byContributionPriority } from "../../core/shared/contributions/metadata";
import { resolveMenuItemState } from "./menu-item-state";

export interface WorkbenchMenuItem {
  id: string;
  commandId: string;
  label: string;
  description?: string;
  icon: string | undefined;
  iconSrc?: string;
  overflowLabel?: string;
  group: string | undefined;
  args: unknown;
  disabled: boolean;
  separatorBefore?: boolean;
  readOnly?: true;
}

interface WorkbenchMenuItemState {
  itemsByPath: Record<string, RegisteredMenuItem[]>;
  commands: Record<string, RegisteredCommand>;
  contextValues: Record<string, ContextKeyValue>;
}

const menuPathKey = (path: MenuPath) => path.join("/");

interface WorkbenchMenuItemContext {
  resource?: ResourceRef | undefined;
}

const resolveContextValues = (state: WorkbenchMenuItemState, context: WorkbenchMenuItemContext | undefined) =>
  context ? scopeWorkbenchResourceContextValues(state.contextValues, context.resource) : state.contextValues;

export const listWorkbenchMenuItemsFromState = (
  state: WorkbenchMenuItemState,
  menuPath: MenuPath,
  context?: WorkbenchMenuItemContext,
) => {
  const contextValues = resolveContextValues(state, context);

  return [...(state.itemsByPath[menuPathKey(menuPath)] ?? [])]
    .sort((left, right) => {
      const leftOrder = left.order ?? 0;
      const rightOrder = right.order ?? 0;
      return leftOrder - rightOrder || byContributionPriority(left, right);
    })
    .map((action) => {
      const record = state.commands[action.commandId];
      if (!record) return null;

      const args = action.args;
      const availability = resolveMenuItemState(action, record, contextValues, context);
      if (!availability) return null;

      return {
        id: action.id,
        commandId: record.command.id,
        label: action.label ?? record.command.label,
        ...(availability.description ? { description: availability.description } : {}),
        icon: action.icon ?? record.command.icon,
        ...(action.iconSrc ? { iconSrc: action.iconSrc } : {}),
        ...(action.overflowLabel ? { overflowLabel: action.overflowLabel } : {}),
        group: action.group,
        args,
        disabled: availability.disabled,
        ...(availability.readOnly ? { readOnly: true } : {}),
      } satisfies WorkbenchMenuItem;
    })
    .filter((item): item is WorkbenchMenuItem => item !== null);
};

export const listWorkbenchMenuItems = (
  workbench: WorkbenchCore,
  menuPath: MenuPath,
  context?: WorkbenchMenuItemContext,
) =>
  listWorkbenchMenuItemsFromState(
    {
      itemsByPath: workbench.layout.menuStore.getState().itemsByPath,
      commands: workbench.commands.store.getState().commands,
      contextValues: workbench.context.store.getState().values,
    },
    menuPath,
    context,
  );
