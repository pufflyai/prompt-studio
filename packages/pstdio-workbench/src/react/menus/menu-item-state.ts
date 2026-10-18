import type { ContextKeyValue, MenuItem, RegisteredCommand, WorkbenchCommandExecutionContext } from "../../core";
import { matchesContextExpression } from "../../core";

export const resolveMenuItemState = (
  action: MenuItem,
  record: RegisteredCommand,
  values: Record<string, ContextKeyValue>,
  context?: WorkbenchCommandExecutionContext,
) => {
  if (
    !matchesContextExpression(values, action.when) ||
    !matchesContextExpression(values, record.command.when) ||
    record.handler.isVisible?.(action.args, context) === false
  )
    return undefined;
  const readOnly =
    action.readOnly === true || Boolean(action.disabledWhen && matchesContextExpression(values, action.disabledWhen));
  const description = action.description ?? record.command.description;
  return {
    readOnly,
    disabled: readOnly || record.handler.isEnabled?.(action.args, context) === false,
    description: readOnly ? (action.disabledReason ?? description) : description,
  };
};
