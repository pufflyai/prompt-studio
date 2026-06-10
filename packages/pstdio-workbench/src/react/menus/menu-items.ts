import type {
  ContextKeyValue,
  MenuPath,
  RegisteredCommand,
  RegisteredMenuItem,
  ResourceRef,
  WorkbenchCore,
} from "../../core";
import {
  createWorkbenchResourceContextValues,
  matchesContextExpression,
  workbenchResourceIdContextKey,
  workbenchResourceKindContextKey,
  workbenchResourceMetadataContextKey,
} from "../../core";
import { byContributionPriority } from "../../core/shared/contributions/metadata";

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

const workbenchResourceMetadataContextKeyPrefix = workbenchResourceMetadataContextKey("");

const isWorkbenchResourceContextKey = (key: string) =>
  key === workbenchResourceKindContextKey ||
  key === workbenchResourceIdContextKey ||
  key.startsWith(workbenchResourceMetadataContextKeyPrefix);

const omitWorkbenchResourceContextValues = (values: Record<string, ContextKeyValue>) => {
  const result: Record<string, ContextKeyValue> = {};

  for (const [key, value] of Object.entries(values)) {
    if (!isWorkbenchResourceContextKey(key)) result[key] = value;
  }

  return result;
};

const resolveContextValues = (state: WorkbenchMenuItemState, context: WorkbenchMenuItemContext | undefined) => {
  const baseContextValues = context ? omitWorkbenchResourceContextValues(state.contextValues) : state.contextValues;

  return {
    ...baseContextValues,
    ...createWorkbenchResourceContextValues(context?.resource),
  };
};

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
    .filter((action) => matchesContextExpression(contextValues, action.when))
    .map((action, index) => {
      const record = state.commands[action.commandId];
      if (!record) return null;

      const args = action.args;
      if (record.handler.isVisible?.(args) === false) return null;

      return {
        id: `${action.commandId}:${index}`,
        commandId: record.command.id,
        label: action.label ?? record.command.label,
        ...((action.description ?? record.command.description)
          ? { description: action.description ?? record.command.description }
          : {}),
        icon: action.icon ?? record.command.icon,
        ...(action.iconSrc ? { iconSrc: action.iconSrc } : {}),
        ...(action.overflowLabel ? { overflowLabel: action.overflowLabel } : {}),
        group: action.group,
        args,
        disabled: action.readOnly === true || record.handler.isEnabled?.(args) === false,
        ...(action.readOnly ? { readOnly: true } : {}),
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
