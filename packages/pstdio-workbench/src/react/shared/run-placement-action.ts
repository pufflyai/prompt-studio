import type { WorkbenchCore, WorkbenchTabAction } from "../../core";
import type { WorkbenchCommandParamsRequest } from "../../core/controllers/command-palette/command-palette-controller";
import { runUserAction } from "../../core/shared/run-user-action";
import { hasCommandParameters } from "../command-palette/command-palette-params";

export const runPlacementAction = (
  workbench: WorkbenchCore,
  action: WorkbenchTabAction,
  requestParams = (request: WorkbenchCommandParamsRequest) => workbench.commandPalette.requestParams(request),
) => {
  const target = action.kind === "navigation" ? action.target : action;
  if (target.kind !== "command") {
    void runUserAction(workbench, "Open", () => workbench.navigation.openTarget(target));
    return;
  }
  const command = workbench.commands.getCommand(target.commandId)?.command;
  if (command && hasCommandParameters(command.params)) {
    requestParams({ record: { command }, label: command.label, args: target.args });
  } else {
    void runUserAction(workbench, command?.label ?? "Command", () =>
      workbench.commands.executeCommand(target.commandId, target.args),
    );
  }
};
