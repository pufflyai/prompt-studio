import type { MenuPath, WorkbenchCommandExecutionContext, WorkbenchCoreContributionContext } from "../../core";
import { scopeWorkbenchResourceContextValues } from "../../core";
import { getNavigationTargetKey } from "../../core/registries/navigation/navigation-target-key";
import { hasCommandParameters, resolveCommandResourceParams } from "../command-palette/command-palette-params";
import type { TreeActionParamsRequest } from "../renderers/tree/tree-actions";
import { resolveMenuItemState } from "./menu-item-state";

export interface ResolveMenuEntriesInput {
  workbench: WorkbenchCoreContributionContext;
  menuPath: MenuPath;
  context?: WorkbenchCommandExecutionContext;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
}

const commandContextValues = (
  workbench: WorkbenchCoreContributionContext,
  context: WorkbenchCommandExecutionContext | undefined,
) =>
  context?.resource
    ? scopeWorkbenchResourceContextValues(workbench.context.snapshot(), context.resource)
    : workbench.context.snapshot();

export const withLeadingSeparator = <T extends { separatorBefore?: boolean }>(items: T[], enabled: boolean) => {
  if (!enabled || items.length === 0) return items;
  const [first, ...rest] = items;
  return [{ ...first, separatorBefore: true }, ...rest];
};

// Menu state without presentation, so native menus and webview bridges share one
// source for visibility, availability, and execution.
export const resolveMenuEntries = (input: ResolveMenuEntriesInput) => {
  const { context, menuPath, onRequestParams, workbench } = input;
  const contextValues = commandContextValues(workbench, context);
  const hints = workbench.keyboard.hints();

  return workbench.layout.listMenuItems(menuPath).flatMap((action) => {
    const record = workbench.commands.getCommand(action.commandId);
    if (!record) return [];
    const state = resolveMenuItemState(action, record, contextValues, context);
    if (!state) return [];

    const { args } = action;
    const label = action.label ?? record.command.label;
    const requestParams =
      hasCommandParameters(record.command.params) && onRequestParams
        ? () =>
            onRequestParams({
              request: { record: { command: record.command }, label, args, context },
              run: async (nextArgs) => {
                await workbench.commands.executeCommand(record.command.id, nextArgs, context);
              },
            })
        : undefined;
    // Resolves when the command finishes or the parameter form opens; rejects when the command fails.
    const run = async () => {
      if (requestParams) {
        requestParams();
        return;
      }
      const bound = resolveCommandResourceParams(record.command.params, args, context);
      const resolvedArgs = Object.keys(bound).length
        ? { ...(typeof args === "object" && args !== null ? args : {}), ...bound }
        : args;
      await workbench.commands.executeCommand(record.command.id, resolvedArgs, context);
    };

    return [
      {
        id: action.id,
        action: {
          kind: "command" as const,
          commandId: action.sourceCommandId ?? record.command.id,
          ...(args === undefined ? {} : { args }),
        },
        label,
        group: action.resourceGroup,
        commandId: action.sourceCommandId ?? record.command.id,
        description: state.description,
        icon: action.icon ?? record.command.icon,
        iconSrc: action.iconSrc,
        external: action.external,
        binding: hints.get(
          getNavigationTargetKey({
            kind: "command",
            commandId: action.sourceCommandId ?? record.command.id,
            ...(args === undefined ? {} : { args }),
          }),
        ),
        kernel: action.group === "kernel",
        disabled: state.disabled,
        readOnly: state.readOnly,
        separatorBefore: action.separatorBefore,
        run: state.readOnly ? undefined : run,
      },
    ];
  });
};

export type MenuEntry = ReturnType<typeof resolveMenuEntries>[number];

export const orderMenuEntries = <T extends { kernel: boolean; separatorBefore?: boolean }>(entries: T[]) => {
  const regular = entries.filter((entry) => !entry.kernel);
  const kernel = entries.filter((entry) => entry.kernel);
  return [...regular, ...withLeadingSeparator(kernel, regular.length > 0)];
};
