import { AlertMessage, DeleteConfirmationModal } from "@pstdio/ui";
import { useState } from "react";
import type { WorkbenchCore } from "../../core";
import { getWorkbenchRenderers } from "../../core";
import type { WorkbenchCommandConfirmation } from "../../core/controllers/command-palette/command-palette-controller";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { type CommandParamFieldRenderer, CommandParamsDialog } from "./command-params-dialog";
import { RendererCreateDialog } from "./renderer-create-dialog";

interface PaletteParamsDialogProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
}

export const PaletteParamsDialog = (props: PaletteParamsDialogProps) => {
  const { workbench, renderParamField } = props;
  const request = useWorkbenchStore(workbench.commandPalette.store, (state) => state.paramsRequest);
  const confirmation = useWorkbenchStore(workbench.commandPalette.store, (state) => state.confirmation);
  const renderers = getWorkbenchRenderers(workbench);
  useWorkbenchStore(renderers.dataStore, (state) => state.renderers);
  const creation =
    request &&
    renderers
      .listKanbanRenderers()
      .find(
        (renderer) =>
          renderer.createCommandId === request.record.command.id && renderer.createRow && renderer.onCreateRow,
      );
  return (
    <>
      {confirmation ? <CommandConfirmationDialog key={confirmation.label} confirmation={confirmation} /> : null}
      {creation ? (
        <RendererCreateDialog
          key={creation.id}
          contribution={creation}
          onClose={() => workbench.commandPalette.clearParams()}
        />
      ) : (
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
      )}
    </>
  );
};

export const CommandConfirmationDialog = (props: { confirmation: WorkbenchCommandConfirmation }) => {
  const { confirmation } = props;
  const [error, setError] = useState<string>();
  return (
    <DeleteConfirmationModal
      open
      headline={`${confirmation.label}?`}
      notificationText={confirmation.description ?? "This cannot be undone."}
      buttonText={confirmation.buttonLabel ?? "Delete"}
      onClose={() => confirmation.resolve(false)}
      onDelete={async () => {
        setError(undefined);
        try {
          await confirmation.onConfirm?.();
          confirmation.resolve(true);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not save. Try again.");
          throw caught;
        }
      }}
    >
      {error ? <AlertMessage status="error" title={error} role="alert" /> : null}
    </DeleteConfirmationModal>
  );
};
