import type { TreeListSection } from "@pstdio/ui";
import type { WorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { CommandParamsDialog } from "../../command-palette/command-params-dialog";
import type { TreeActionParamsRequest } from "./tree-actions";

import { treeActionParamsFallback } from "./tree-inline-input";

interface TreeParamsDialogProps {
  sections?: TreeListSection[];
  expansion?: { expandedNodeIds: string[]; expandedSectionIds: string[] };
  request: TreeActionParamsRequest | null;
  renderParamField?: CommandParamFieldRenderer;
  workbench: WorkbenchCore;
  onClose: () => void;
}

export const TreeParamsDialog = (props: TreeParamsDialogProps) => {
  const { renderParamField, workbench, onClose } = props;
  const request = treeActionParamsFallback(props.sections ?? [], props.request, props.expansion);
  return (
    <CommandParamsDialog
      request={request?.request ?? null}
      renderParamField={renderParamField}
      executeOptionCommand={(id, args, signal) =>
        workbench.commands.executeCommand(id, args, { ...request?.request.context, signal })
      }
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
