import type { WorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { CommandParamsDialog } from "../../command-palette/command-params-dialog";
import type { TreeActionParamsRequest } from "./tree-actions";

interface TreeParamsDialogProps {
  request: TreeActionParamsRequest | null;
  renderParamField?: CommandParamFieldRenderer;
  workbench: WorkbenchCore;
  onClose: () => void;
}

export const TreeParamsDialog = (props: TreeParamsDialogProps) => {
  const { request, renderParamField, workbench, onClose } = props;
  return (
    <CommandParamsDialog
      request={request?.request ?? null}
      renderParamField={renderParamField}
      prepareArgs={(input) =>
        workbench.commands.getCommand(input.commandId)
          ? workbench.commands.prepareCommandArgs(input.commandId, input.args, input.context, input.onArgsChange)
          : Promise.resolve(input.args)
      }
      onClose={onClose}
      onRun={async ({ args }) => {
        await request?.run(args);
      }}
    />
  );
};
