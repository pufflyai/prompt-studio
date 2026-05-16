import type { ContextKeyValue, MenuPath, RegisteredCommand, RegisteredMenuAction, ShellCore } from "../../core";
import { byContributionPriority } from "../../core/shared/contributions/metadata";

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

interface ShellMenuActionItemState {
  actionsByPath: Record<string, RegisteredMenuAction[]>;
  commands: Record<string, RegisteredCommand>;
  contextValues: Record<string, ContextKeyValue>;
}

const menuPathKey = (path: MenuPath) => path.join("/");

const readComparisonValue = (value: string) => value.replace(/^['"]|['"]$/g, "");

const matchesContextTerm = (values: Record<string, ContextKeyValue>, term: string) => {
  const trimmed = term.trim();
  if (trimmed.length === 0) return true;

  const comparison = trimmed.match(/^([A-Za-z0-9_.-]+)\s*(==|!=)\s*(.+)$/);
  if (comparison) {
    const [, key, operator, rawValue] = comparison;
    const actual = values[key ?? ""];
    const expected = readComparisonValue(rawValue ?? "");
    return operator === "==" ? String(actual) === expected : String(actual) !== expected;
  }

  if (trimmed.startsWith("!")) return !values[trimmed.slice(1)];

  return Boolean(values[trimmed]);
};

const matchesContext = (values: Record<string, ContextKeyValue>, expression?: string) =>
  !expression || expression.split("&&").every((term) => matchesContextTerm(values, term));

export const listShellMenuActionItemsFromState = (state: ShellMenuActionItemState, menuPath: MenuPath) =>
  [...(state.actionsByPath[menuPathKey(menuPath)] ?? [])]
    .sort((left, right) => {
      const leftOrder = left.order ?? 0;
      const rightOrder = right.order ?? 0;
      return leftOrder - rightOrder || byContributionPriority(left, right);
    })
    .filter((action) => matchesContext(state.contextValues, action.when))
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
      } satisfies ShellMenuActionItem;
    })
    .filter((item): item is ShellMenuActionItem => item !== null);

export const listShellMenuActionItems = (shell: ShellCore, menuPath: MenuPath) =>
  listShellMenuActionItemsFromState(
    {
      actionsByPath: shell.menus.store.getState().actionsByPath,
      commands: shell.commands.store.getState().commands,
      contextValues: shell.context.store.getState().values,
    },
    menuPath,
  );
