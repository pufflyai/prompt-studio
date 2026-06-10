import { Box, HStack, Text } from "@chakra-ui/react";
import { PaletteShortcut, type TreeListAction, type TreeListActionMenuItem } from "@pstdio/ui";
import type {
  ContextKeyValue,
  KeybindingSequence,
  MenuPath,
  RegisteredCommand,
  TreeAction,
  WorkbenchCommandExecutionContext,
  WorkbenchCore,
} from "../../../core";
import { createWorkbenchResourceContextValues, matchesContextExpression } from "../../../core";
import { hasCommandParameters } from "../../command-palette/command-palette-params";
import type { CommandParamsRequest } from "../../command-palette/command-params-dialog";
import { WorkbenchIcon } from "../../shared/icon";

export interface TreeActionParamsRequest {
  request: CommandParamsRequest;
  run: (args: unknown) => Promise<void>;
}

interface CreateTreeActionItemsInput {
  actions?: TreeAction[];
  workbench: WorkbenchCore;
  context?: WorkbenchCommandExecutionContext;
  onCommandError?: (error: unknown) => void;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
}

interface CreateTreeMenuItemsInput {
  workbench: WorkbenchCore;
  menuPath: MenuPath;
  context?: WorkbenchCommandExecutionContext;
  onCommandError?: (error: unknown) => void;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
}

interface CreateTreeContextMenuItemsInput {
  actions?: TreeAction[];
  menuPath?: MenuPath;
  workbench: WorkbenchCore;
  context?: WorkbenchCommandExecutionContext;
  onCommandError?: (error: unknown) => void;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
}

const commandContextValues = (
  workbench: WorkbenchCore,
  context: WorkbenchCommandExecutionContext | undefined,
): Record<string, ContextKeyValue> => ({
  ...workbench.context.snapshot(),
  ...createWorkbenchResourceContextValues(context?.resource),
});

const isRegisteredCommandVisible = (
  record: RegisteredCommand,
  args: unknown,
  contextValues: Record<string, ContextKeyValue>,
) => {
  if (!matchesContextExpression(contextValues, record.command.when)) return false;
  return record.handler.isVisible?.(args) !== false;
};

const executeTreeAction = async (input: {
  action: TreeAction;
  workbench: WorkbenchCore;
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
  workbench: WorkbenchCore;
  onCommandError?: (error: unknown) => void;
  args?: unknown;
  context?: WorkbenchCommandExecutionContext;
}) => {
  const { action, args, context, onCommandError, workbench } = input;
  try {
    await executeTreeAction({ action, args, context, workbench });
  } catch (error) {
    onCommandError?.(error);
    throw error;
  }
};

const resolveTreeActionCommand = (workbench: WorkbenchCore, action: TreeAction) => {
  if (!action.commandId) return undefined;
  return workbench.commands.getCommand(action.commandId);
};

const isTreeActionVisible = (
  workbench: WorkbenchCore,
  action: TreeAction,
  contextValues: Record<string, ContextKeyValue>,
) => {
  if (!matchesContextExpression(contextValues, action.when)) return false;

  const record = resolveTreeActionCommand(workbench, action);
  if (action.commandId && !record) return false;

  return record ? isRegisteredCommandVisible(record, action.args, contextValues) : true;
};

const isTreeActionEnabled = (workbench: WorkbenchCore, action: TreeAction) => {
  if (action.disabled) return false;

  const record = resolveTreeActionCommand(workbench, action);
  return record ? workbench.commands.isCommandEnabled(record.command.id, action.args) : true;
};

const createMenuIcon = (input: { icon?: string; iconSrc?: string }) => {
  const { icon, iconSrc } = input;
  if (iconSrc) {
    return (
      <Box boxSize="16px" bg="white" borderRadius="4px" p="1px" display="grid" placeItems="center">
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          width={14}
          height={14}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
        />
      </Box>
    );
  }

  return icon ? <WorkbenchIcon name={icon} /> : undefined;
};

const createMenuEndContent = (input: { external?: boolean; binding?: KeybindingSequence }) => {
  const { binding, external } = input;
  if (external) return <WorkbenchIcon name="ArrowUpRight" size={14} color="fg.muted" />;
  if (binding) return <PaletteShortcut binding={binding} />;
  return undefined;
};

export const createTreeMenuItems = (input: CreateTreeMenuItemsInput) => {
  const { context, menuPath, onCommandError, onRequestParams, workbench } = input;
  const contextValues = commandContextValues(workbench, context);
  const shortcuts = new Map(workbench.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListActionMenuItem[] = [];

  for (const [index, action] of workbench.layout.listMenuItems(menuPath).entries()) {
    if (!matchesContextExpression(contextValues, action.when)) continue;

    const record = workbench.commands.getCommand(action.commandId);
    if (!record) continue;

    const args = action.args;
    if (!isRegisteredCommandVisible(record, args, contextValues)) continue;

    const icon = action.icon ?? record.command.icon;
    const binding = shortcuts.get(record.command.id);
    const readOnly = action.readOnly === true;
    const label = action.label ?? record.command.label;
    const requestParams =
      hasCommandParameters(record.command.params) && onRequestParams
        ? () =>
            onRequestParams({
              request: {
                record: { command: record.command },
                label,
                args,
                context,
              },
              run: async (nextArgs) => {
                try {
                  await workbench.commands.executeCommand(record.command.id, nextArgs, context);
                } catch (error) {
                  onCommandError?.(error);
                  throw error;
                }
              },
            })
        : undefined;
    items.push({
      id: `${action.commandId}:${index}`,
      label,
      description: action.description ?? record.command.description,
      icon: createMenuIcon({ icon, iconSrc: action.iconSrc }),
      endContent: createMenuEndContent({ external: action.external, binding }),
      disabled: readOnly || !workbench.commands.isCommandEnabled(record.command.id, args),
      readOnly,
      onAction: readOnly
        ? undefined
        : () => {
            if (requestParams) {
              requestParams();
              return;
            }
            void workbench.commands
              .executeCommand(record.command.id, args, context)
              .catch((error) => onCommandError?.(error));
          },
    });
  }

  return items;
};

const createTreeActionMenuItems = (input: CreateTreeContextMenuItemsInput) => {
  const { actions = [], context, onCommandError, onRequestParams, workbench } = input;
  const contextValues = commandContextValues(workbench, context);
  const shortcuts = new Map(workbench.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListActionMenuItem[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(workbench, action, contextValues)) continue;

    const record = resolveTreeActionCommand(workbench, action);
    const label = action.label ?? record?.command.label;
    if (!label) continue;

    const icon = action.icon ?? record?.command.icon;
    const disabled = !isTreeActionEnabled(workbench, action);
    const binding = action.commandId ? shortcuts.get(action.commandId) : undefined;
    const requestParams =
      hasCommandParameters(action.params) && onRequestParams
        ? () =>
            onRequestParams({
              request: {
                record: { command: { id: action.commandId ?? action.id, label, params: action.params } },
                label,
                submitLabel: action.submitLabel,
                args: action.args,
                context,
              },
              run: (args) => runTreeAction({ action, args, context, workbench, onCommandError }),
            })
        : undefined;
    items.push({
      id: action.id,
      label,
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

export const createTreeContextMenuItems = (input: CreateTreeContextMenuItemsInput) => [
  ...(input.menuPath ? createTreeMenuItems({ ...input, menuPath: input.menuPath }) : []),
  ...createTreeActionMenuItems(input),
];

export const createTreeActionItems = (input: CreateTreeActionItemsInput) => {
  const { actions = [], context, onCommandError, onRequestParams, workbench } = input;
  const contextValues = commandContextValues(workbench, context);
  const shortcuts = new Map(workbench.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListAction[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(workbench, action, contextValues) || !isTreeActionEnabled(workbench, action)) continue;

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
                record: { command: { id: action.commandId ?? action.id, label, params: action.params } },
                label,
                submitLabel: action.submitLabel,
                args: action.args,
                context,
              },
              run: (args) => runTreeAction({ action, args, context, workbench, onCommandError }),
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
