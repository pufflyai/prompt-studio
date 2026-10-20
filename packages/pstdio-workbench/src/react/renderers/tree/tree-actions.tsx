import { createMenuItemGroups, createMenuItems } from "../../menus/command-menu-items";
import { withLeadingSeparator } from "../../menus/menu-entries";
export const createTreeMenuItems = createMenuItems;

import { HStack, Text } from "@chakra-ui/react";
import { PaletteShortcut, type TreeListAction, type TreeListActionMenuItem } from "@pstdio/ui";
import type {
  ContextKeyValue,
  MenuPath,
  RegisteredCommand,
  TreeAction,
  WorkbenchCommandExecutionContext,
  WorkbenchCoreContributionContext,
} from "../../../core";
import { matchesContextExpression, scopeWorkbenchResourceContextValues } from "../../../core";
import { reportUserActionError } from "../../../core/shared/run-user-action";
import { hasCommandParameters } from "../../command-palette/command-palette-params";
import type { CommandParamsRequest } from "../../command-palette/command-params-dialog";
import { WorkbenchIcon } from "../../shared/icon";

export interface TreeActionParamsRequest {
  request: CommandParamsRequest;
  run: (args: unknown) => Promise<void>;
}

interface CreateTreeActionItemsInput {
  actions?: TreeAction[];
  workbench: WorkbenchCoreContributionContext;
  context?: WorkbenchCommandExecutionContext;
  onCommandError?: (error: unknown) => void;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
}

interface CreateTreeContextMenuItemsInput {
  actions?: TreeAction[];
  menuPath?: MenuPath;
  workbench: WorkbenchCoreContributionContext;
  context?: WorkbenchCommandExecutionContext;
  onCommandError?: (error: unknown) => void;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
}

const commandContextValues = (
  workbench: WorkbenchCoreContributionContext,
  context: WorkbenchCommandExecutionContext | undefined,
): Record<string, ContextKeyValue> =>
  context?.resource
    ? scopeWorkbenchResourceContextValues(workbench.context.snapshot(), context.resource)
    : workbench.context.snapshot();

const isRegisteredCommandVisible = (
  record: RegisteredCommand,
  args: unknown,
  contextValues: Record<string, ContextKeyValue>,
  context?: WorkbenchCommandExecutionContext,
) => {
  if (!matchesContextExpression(contextValues, record.command.when)) return false;
  return record.handler.isVisible?.(args, context) !== false;
};

const executeTreeAction = async (input: {
  action: TreeAction;
  workbench: WorkbenchCoreContributionContext;
  args?: unknown;
  context?: WorkbenchCommandExecutionContext;
}) => {
  const { action, args, context, workbench } = input;
  const record = action.commandId ? workbench.commands.getCommand(action.commandId) : undefined;
  const resolvedArgs = args ?? action.args;
  await (record
    ? workbench.commands.executeCommand(record.command.id, resolvedArgs, context)
    : action.run?.(resolvedArgs));
};

const runTreeAction = async (input: {
  action: TreeAction;
  workbench: WorkbenchCoreContributionContext;
  onCommandError?: (error: unknown) => void;
  args?: unknown;
  context?: WorkbenchCommandExecutionContext;
}) => {
  const { action, args, context, onCommandError, workbench } = input;
  try {
    await executeTreeAction({ action, args, context, workbench });
  } catch (error) {
    if (onCommandError) onCommandError(error);
    else reportUserActionError(workbench, action.label ?? "Action", error);
    throw error;
  }
};

const resolveTreeActionCommand = (workbench: WorkbenchCoreContributionContext, action: TreeAction) => {
  if (!action.commandId) return undefined;
  return workbench.commands.getCommand(action.commandId);
};

const isTreeActionVisible = (
  workbench: WorkbenchCoreContributionContext,
  action: TreeAction,
  contextValues: Record<string, ContextKeyValue>,
  context?: WorkbenchCommandExecutionContext,
) => {
  if (!matchesContextExpression(contextValues, action.when)) return false;

  const record = resolveTreeActionCommand(workbench, action);
  if (action.commandId && !record) return false;

  return record ? isRegisteredCommandVisible(record, action.args, contextValues, context) : true;
};

const isTreeActionEnabled = (
  workbench: WorkbenchCoreContributionContext,
  action: TreeAction,
  context?: WorkbenchCommandExecutionContext,
) => {
  if (action.disabled) return false;

  const record = resolveTreeActionCommand(workbench, action);
  return record ? workbench.commands.isCommandEnabled(record.command.id, action.args, context) : true;
};

const createTreeActionMenuItems = (input: CreateTreeContextMenuItemsInput) => {
  const { actions = [], context, onCommandError, onRequestParams, workbench } = input;
  if (actions.length === 0) return [];
  const contextValues = commandContextValues(workbench, context);
  const shortcuts = new Map(workbench.keybindings.listCommandKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListActionMenuItem[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(workbench, action, contextValues, context)) continue;

    const record = resolveTreeActionCommand(workbench, action);
    const label = action.label ?? record?.command.label;
    if (!label) continue;

    const icon = action.icon ?? record?.command.icon;
    const disabled = !isTreeActionEnabled(workbench, action, context);
    const binding = action.commandId ? shortcuts.get(action.commandId) : undefined;
    const requestParams =
      hasCommandParameters(action.params) && onRequestParams
        ? () =>
            onRequestParams({
              request: {
                record: {
                  command: {
                    id: action.commandId ?? action.id,
                    label,
                    params: action.params,
                    resourceMutation: action.resourceMutation ?? record?.command.resourceMutation,
                  },
                },
                label,
                submitLabel: action.submitLabel,
                args: action.args,
                context,
              },
              run: (args) => executeTreeAction({ action, args, context, workbench }),
            })
        : undefined;
    items.push({
      id: action.id,
      label,
      commandId: record?.command.id ?? action.commandId,
      icon: icon ? <WorkbenchIcon name={icon} /> : undefined,
      endContent: binding ? <PaletteShortcut binding={binding} /> : undefined,
      disabled,
      onAction: () => {
        if (disabled) return;
        if (requestParams) {
          requestParams();
          return;
        }
        void runTreeAction({ action, context, workbench, onCommandError }).catch(() => undefined);
      },
    });
  }

  return items;
};

export const createTreeContextMenuItems = (input: CreateTreeContextMenuItemsInput) => {
  const actionItems = createTreeActionMenuItems(input);
  const { regularItems, kernelItems } = input.menuPath
    ? createMenuItemGroups({ ...input, menuPath: input.menuPath })
    : { regularItems: [], kernelItems: [] };
  const visibleRegularItems = [...actionItems, ...regularItems];

  return [...visibleRegularItems, ...withLeadingSeparator(kernelItems, visibleRegularItems.length > 0)];
};

export const createTreeActionItems = (input: CreateTreeActionItemsInput) => {
  const { actions = [], context, onCommandError, onRequestParams, workbench } = input;
  if (actions.length === 0) return [];
  const contextValues = commandContextValues(workbench, context);
  const shortcuts = new Map(workbench.keybindings.listCommandKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListAction[] = [];

  for (const action of actions) {
    if (
      !isTreeActionVisible(workbench, action, contextValues, context) ||
      !isTreeActionEnabled(workbench, action, context)
    )
      continue;

    const record = resolveTreeActionCommand(workbench, action);
    const label = action.label ?? record?.command.label;
    if (!label) continue;

    const icon = action.icon ?? record?.command.icon;
    const binding = action.commandId ? shortcuts.get(action.commandId) : undefined;
    const requestParams =
      hasCommandParameters(action.params) && onRequestParams
        ? () =>
            onRequestParams({
              request: {
                record: {
                  command: {
                    id: action.commandId ?? action.id,
                    label,
                    params: action.params,
                    resourceMutation: action.resourceMutation ?? record?.command.resourceMutation,
                  },
                },
                label,
                submitLabel: action.submitLabel,
                args: action.args,
                context,
              },
              run: (args) => executeTreeAction({ action, args, context, workbench }),
            })
        : undefined;
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
        if (requestParams) {
          requestParams();
          return;
        }
        void runTreeAction({ action, context, workbench, onCommandError }).catch(() => undefined);
      },
    });
  }

  return items;
};
