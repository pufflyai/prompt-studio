import { Box, Image } from "@chakra-ui/react";
import { PaletteShortcut, Tooltip, type TreeListActionMenuItem } from "@pstdio/ui";
import type {
  ContextKeyValue,
  KeybindingSequence,
  MenuPath,
  WorkbenchCommandExecutionContext,
  WorkbenchCoreContributionContext,
} from "../../core";
import { scopeWorkbenchResourceContextValues } from "../../core";
import { reportUserActionError } from "../../core/shared/run-user-action";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import type { TreeActionParamsRequest } from "../renderers/tree/tree-actions";
import { WorkbenchIcon } from "../shared/icon";
import { resolveMenuItemState } from "./menu-item-state";
export interface CreateMenuItemsInput {
  workbench: WorkbenchCoreContributionContext;
  menuPath: MenuPath;
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

const createMenuIcon = (input: { icon?: string; iconSrc?: string }) => {
  const { icon, iconSrc } = input;
  if (iconSrc) {
    return (
      <Box boxSize="16px" bg="white" borderRadius="4px" p="1px" display="grid" placeItems="center">
        <Image
          src={iconSrc}
          alt=""
          aria-hidden="true"
          htmlWidth={14}
          htmlHeight={14}
          display="block"
          w="full"
          h="full"
          fit="contain"
        />
      </Box>
    );
  }

  return icon ? <WorkbenchIcon name={icon} /> : undefined;
};

export const createMenuEndContent = (input: {
  external?: boolean;
  binding?: KeybindingSequence;
  disabledReason?: string;
  readOnly?: boolean;
}) => {
  const { binding, external, disabledReason, readOnly } = input;
  if (readOnly && disabledReason)
    return (
      <Tooltip content={disabledReason} openDelay={300}>
        <Box as="span" tabIndex={0} aria-label={disabledReason}>
          <WorkbenchIcon name="Info" />
        </Box>
      </Tooltip>
    );
  if (external) return <WorkbenchIcon name="ArrowUpRight" size={14} color="fg.muted" />;
  if (binding) return <PaletteShortcut binding={binding} />;
  return undefined;
};

export const withLeadingSeparator = <T extends TreeListActionMenuItem>(items: T[], enabled: boolean) => {
  if (!enabled || items.length === 0) return items;
  const [first, ...rest] = items;
  return [{ ...first, separatorBefore: true }, ...rest];
};

const isKernelMenuAction = (group: string | undefined) => group === "kernel";
export const createMenuItemGroups = (input: CreateMenuItemsInput) => {
  const { context, menuPath, onCommandError, onRequestParams, workbench } = input;
  const contextValues = commandContextValues(workbench, context);
  const shortcuts = new Map(workbench.keybindings.listCommandKeybindings().map((k) => [k.commandId, k.keybinding]));
  const regularItems: TreeListActionMenuItem[] = [];
  const kernelItems: TreeListActionMenuItem[] = [];

  for (const action of workbench.layout.listMenuItems(menuPath)) {
    const record = workbench.commands.getCommand(action.commandId);
    if (!record) continue;

    const args = action.args;
    const state = resolveMenuItemState(action, record, contextValues, context);
    if (!state) continue;

    const icon = action.icon ?? record.command.icon;
    const binding = shortcuts.get(record.command.id);
    const readOnly = state.readOnly;
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
                await workbench.commands.executeCommand(record.command.id, nextArgs, context);
              },
            })
        : undefined;
    const item = {
      id: action.id,
      label,
      group: action.resourceGroup,
      commandId: action.sourceCommandId ?? record.command.id,
      description: state.description,
      icon: createMenuIcon({ icon, iconSrc: action.iconSrc }),
      endContent: createMenuEndContent({
        external: action.external,
        binding,
        disabledReason: state.description,
        readOnly,
      }),
      disabled: state.disabled,
      readOnly,
      separatorBefore: action.separatorBefore,
      onAction: readOnly
        ? undefined
        : () => {
            if (requestParams) {
              requestParams();
              return;
            }
            void workbench.commands.executeCommand(record.command.id, args, context).catch((error) => {
              if (onCommandError) onCommandError(error);
              else reportUserActionError(workbench, label, error);
            });
          },
    };

    if (isKernelMenuAction(action.group)) {
      kernelItems.push(item);
    } else {
      regularItems.push(item);
    }
  }

  return { regularItems, kernelItems };
};

export const createMenuItems = (input: CreateMenuItemsInput) => {
  const { regularItems, kernelItems } = createMenuItemGroups(input);
  return [...regularItems, ...withLeadingSeparator(kernelItems, regularItems.length > 0)];
};
