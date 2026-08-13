import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { CommandParamsDialog } from "../../command-palette/command-params-dialog";
import type { TreeActionParamsRequest } from "./tree-actions";

interface TreeParamsDialogProps {
  request: TreeActionParamsRequest | null;
  renderParamField?: CommandParamFieldRenderer;
  onClose: () => void;
}

export const TreeParamsDialog = (props: TreeParamsDialogProps) => {
  const { request, renderParamField, onClose } = props;
  return (
    <CommandParamsDialog
      request={request?.request ?? null}
      renderParamField={renderParamField}
      onClose={onClose}
      onRun={async ({ args }) => {
        await request?.run(args);
      }}
    />
  );
};
