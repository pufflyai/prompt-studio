import type { NavigationTarget, WorkbenchCore } from "../../core";
import type { WorkbenchCommandExecutionContext } from "../../core/registries/commands/command-registry";

export const executeActionBarTarget = (
  workbench: WorkbenchCore,
  target: NavigationTarget,
  context: WorkbenchCommandExecutionContext,
) => {
  if (target.kind === "command") return workbench.commands.executeCommand(target.commandId, target.args, context);
  const invocation = target.kind === "viewer" ? workbench.viewers.captureContext(context.placement) : undefined;
  return workbench.navigation.openTarget(target, invocation);
};
