import type { ResourceRef, WorkbenchCore, WorkbenchTabAction } from "../../core";
import type { WorkbenchCommandParamsRequest } from "../../core/controllers/command-palette/command-palette-controller";
import type { WorkbenchCommandExecutionContext } from "../../core/registries/commands/command-registry";
import type { NavigationInvocationContext } from "../../core/registries/navigation/navigation-registry";
import { runUserAction } from "../../core/shared/run-user-action";
import { hasCommandParameters } from "../command-palette/command-palette-params";

export const runPlacementAction = (
  workbench: WorkbenchCore,
  action: WorkbenchTabAction,
  requestParams = (request: WorkbenchCommandParamsRequest) => workbench.commandPalette.requestParams(request),
  resource?: ResourceRef,
  context?: WorkbenchCommandExecutionContext,
  invocation: NavigationInvocationContext = workbench.viewers.captureContext(context?.placement),
) => {
  const execution = {
    ...context,
    resource,
    projectId: context?.projectId ?? invocation.projectId,
    removalVersion: invocation.removalVersion,
    isViewerCurrent: invocation.isViewerCurrent,
  };
  const target = action.kind === "navigation" ? action.target : action;
  if (target.kind !== "command") {
    void runUserAction(workbench, "Open", () =>
      workbench.navigation.openTarget(target, {
        ...invocation,
        projectId: context?.projectId ?? invocation.projectId,
      }),
    );
    return;
  }
  const command = workbench.commands.getCommand(target.commandId)?.command;
  if (command && hasCommandParameters(command.params)) {
    requestParams({
      record: { command },
      label: command.label,
      args: target.args,
      context: execution,
    });
  } else {
    void runUserAction(workbench, command?.label ?? "Command", () =>
      workbench.commands.executeCommand(target.commandId, target.args, execution),
    );
  }
};
