import { type Disposable, type ShellCore, workbenchTopHeaderTrailingMenuPath } from "pstdio-shell/core";
import {
  buildHeaderActionGroups,
  type HeaderActionItem,
} from "@/features/plugin-actions/components/header-action-groups";

const disposeAll = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    disposables[index]?.dispose();
  }
};

interface RegisterShellHeaderActionsInput {
  category: string;
  commandPrefix: string;
  defaultOverflowActions: HeaderActionItem[];
  onPluginAction: (actionKey: string, targetId: string) => void;
  pendingActionKeys: string[];
  pluginActions: Parameters<typeof buildHeaderActionGroups>[0]["pluginActions"];
  overflowLabel?: string;
  resolveIcon?: (action: HeaderActionItem) => string | undefined;
  shell: Pick<ShellCore, "commands" | "menus">;
  targetId: string;
}

const isHeaderActionDisabled = (action: HeaderActionItem, pendingActionKeys: string[]) =>
  Boolean(action.isDisabled || pendingActionKeys.includes(action.key));

export const registerShellHeaderActions = (input: RegisterShellHeaderActionsInput) => {
  const {
    category,
    commandPrefix,
    defaultOverflowActions,
    onPluginAction,
    overflowLabel,
    pendingActionKeys,
    pluginActions,
    resolveIcon,
    shell,
    targetId,
  } = input;
  const groups = buildHeaderActionGroups({
    pluginActions,
    defaultOverflowActions,
    onPluginAction: (actionKey) => onPluginAction(actionKey, targetId),
  });
  const actionGroups = [
    ...groups.primary.map((action, index) => ({ action, group: "primary", order: index })),
    ...groups.secondary.map((action, index) => ({ action, group: "secondary", order: 100 + index })),
    ...groups.overflow.map((action, index) => ({ action, group: "overflow", order: 200 + index })),
  ];
  const disposables: Disposable[] = [];

  actionGroups.forEach(({ action, group, order }, commandIndex) => {
    const commandId = `${commandPrefix}.${commandIndex}.${action.key}`;
    const icon = resolveIcon?.(action);
    disposables.push(
      shell.commands.registerCommand(
        {
          id: commandId,
          label: action.label,
          category,
          icon,
        },
        {
          execute: () => action.onClick(),
          isEnabled: () => !isHeaderActionDisabled(action, pendingActionKeys),
        },
      ),
      shell.menus.registerMenuAction(workbenchTopHeaderTrailingMenuPath, {
        commandId,
        label: action.label,
        icon,
        ...(group === "overflow" && overflowLabel ? { overflowLabel } : {}),
        group,
        order,
      }),
    );
  });

  return () => disposeAll(disposables);
};
