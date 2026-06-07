import { Box, HStack, Text } from "@chakra-ui/react";
import { PaletteShortcut, type TreeListAction, type TreeListActionMenuItem } from "@pstdio/ui";
import type { KeybindingSequence, MenuPath, TreeAction, WorkbenchCore } from "../../../core";
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
  onCommandError?: (error: unknown) => void;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
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
  onRequestParams?: (request: TreeActionParamsRequest) => void;
}

const executeTreeAction = async (input: { action: TreeAction; workbench: WorkbenchCore; args?: unknown }) => {
  const { action, args, workbench } = input;
  const record = action.commandId ? workbench.commands.getCommand(action.commandId) : undefined;
  const resolvedArgs = args ?? action.args;
  await (record ? workbench.commands.executeCommand(record.command.id, resolvedArgs) : action.run?.(resolvedArgs));
};

const runTreeAction = async (input: {
  action: TreeAction;
  workbench: WorkbenchCore;
  onCommandError?: (error: unknown) => void;
  args?: unknown;
}) => {
  const { action, args, onCommandError, workbench } = input;
  try {
    await executeTreeAction({ action, args, workbench });
  } catch (error) {
    onCommandError?.(error);
    throw error;
  }
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
    const readOnly = action.readOnly === true;
    items.push({
      id: `${action.commandId}:${index}`,
      label: action.label ?? record.command.label,
      description: action.description ?? record.command.description,
      icon: createMenuIcon({ icon, iconSrc: action.iconSrc }),
      endContent: createMenuEndContent({ external: action.external, binding }),
      disabled: readOnly || !workbench.commands.isCommandEnabled(record.command.id, args),
      readOnly,
      onAction: readOnly
        ? undefined
        : () => {
            void workbench.commands.executeCommand(record.command.id, args).catch((error) => onCommandError?.(error));
          },
    });
  }

  return items;
};

const createTreeActionMenuItems = (input: CreateTreeContextMenuItemsInput) => {
  const { actions = [], onCommandError, onRequestParams, workbench } = input;
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
    const requestParams =
      hasCommandParameters(action.params) && onRequestParams
        ? () =>
            onRequestParams({
              request: {
                record: { command: { id: action.commandId ?? action.id, label, params: action.params } },
                label,
                args: action.args,
              },
              run: (args) => runTreeAction({ action, args, workbench, onCommandError }),
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
        void runTreeAction({ action, workbench, onCommandError }).catch(() => undefined);
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
  const { actions = [], onCommandError, onRequestParams, workbench } = input;
  const shortcuts = new Map(workbench.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]));
  const items: TreeListAction[] = [];

  for (const action of actions) {
    if (!isTreeActionVisible(workbench, action) || !isTreeActionEnabled(workbench, action)) continue;

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
                args: action.args,
              },
              run: (args) => runTreeAction({ action, args, workbench, onCommandError }),
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
        void runTreeAction({ action, workbench, onCommandError }).catch(() => undefined);
      },
    });
  }

  return items;
};
