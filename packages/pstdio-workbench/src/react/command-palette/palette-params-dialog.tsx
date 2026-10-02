import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { type CommandParamFieldRenderer, CommandParamsDialog } from "./command-params-dialog";

interface PaletteParamsDialogProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
}

export const PaletteParamsDialog = (props: PaletteParamsDialogProps) => {
  const { workbench, renderParamField } = props;
  const request = useWorkbenchStore(workbench.commandPalette.store, (state) => state.paramsRequest);
  return (
    <CommandParamsDialog
      request={request}
      renderParamField={renderParamField}
      executeOptionCommand={(id, args, signal) =>
        workbench.commands.executeCommand(id, args, { ...request?.context, signal })
      }
      prepareArgs={(input) =>
        workbench.commands.prepareCommandArgs(input.commandId, input.args, input.context, input.onArgsChange)
      }
      onClose={() => workbench.commandPalette.clearParams()}
      // The dialog shows a failure itself and stays open, so let the error reach it.
      onRun={async ({ commandId, args, context }) => {
        await workbench.commands.executeCommand(commandId, args, context);
      }}
    />
  );
};
