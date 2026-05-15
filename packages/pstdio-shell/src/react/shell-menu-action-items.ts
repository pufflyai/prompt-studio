import type { MenuPath, ShellCore } from "../core";

export interface ShellMenuActionItem {
  id: string;
  commandId: string;
  label: string;
  icon: string | undefined;
  overflowLabel?: string;
  group: string | undefined;
  args: unknown;
  disabled: boolean;
}

export const listShellMenuActionItems = (shell: ShellCore, menuPath: MenuPath) =>
  shell.menus
    .listMenuActions(menuPath)
    .filter((action) => shell.context.matches(action.when))
    .map((action, index) => {
      const record = shell.commands.getCommand(action.commandId);
      if (!record) return null;

      const args = action.args;
      if (!shell.commands.isCommandVisible(record.command.id, args)) return null;

      return {
        id: `${action.commandId}:${index}`,
        commandId: record.command.id,
        label: action.label ?? record.command.label,
        icon: action.icon ?? record.command.icon,
        ...(action.overflowLabel ? { overflowLabel: action.overflowLabel } : {}),
        group: action.group,
        args,
        disabled: !shell.commands.isCommandEnabled(record.command.id, args),
      } satisfies ShellMenuActionItem;
    })
    .filter((item): item is ShellMenuActionItem => item !== null);
