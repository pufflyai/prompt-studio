import { Button, HStack, Text } from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import type { WorkbenchCommandExecutionContext, WorkbenchCore } from "../../core";
import type { ViewToolbarAction } from "../../core/registries/renderers/view-toolbar-action";
import type { CommandParamFieldRenderer } from "../command-palette/command-params-dialog";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { createTreeContextMenuItems, type TreeActionParamsRequest } from "./tree/tree-actions";
import { TreeParamsDialog } from "./tree/tree-params-dialog";

interface ViewToolbarActionsProps {
  workbench: WorkbenchCore;
  actions?: ViewToolbarAction[];
  context?: WorkbenchCommandExecutionContext;
  renderParamField?: CommandParamFieldRenderer;
}

export const ViewToolbarActions = (props: ViewToolbarActionsProps) => {
  const { workbench, actions, context, renderParamField } = props;
  const [request, setRequest] = useState<TreeActionParamsRequest | null>(null);
  const [error, setError] = useState<string>();
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const items = createTreeContextMenuItems({
    workbench,
    actions,
    context,
    onRequestParams: setRequest,
    onCommandError: (error) => setError(error instanceof Error ? error.message : String(error)),
  });
  return (
    <>
      <HStack gap="xs">
        {items.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={
              actions?.find((action) => action.id === item.id)?.presentation === "primary" ? "primary" : "outline"
            }
            disabled={item.disabled}
            onClick={() => {
              setError(undefined);
              item.onAction?.();
            }}
          >
            {item.icon as ReactNode}
            {item.label}
          </Button>
        ))}
        {error ? (
          <Text role="alert" textStyle="paragraph/XS/regular" color="fg.error">
            {error}
          </Text>
        ) : null}
      </HStack>
      <TreeParamsDialog
        workbench={workbench}
        request={request}
        renderParamField={renderParamField}
        onClose={() => setRequest(null)}
      />
    </>
  );
};
