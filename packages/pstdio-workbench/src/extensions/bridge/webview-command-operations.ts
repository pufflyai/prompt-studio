import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { CommandOutcomeError, type ResourceRef } from "@pstdio/sdk/extensions";
import { UnresolvedSubmissionError } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { unwrapCommandValue } from "../host/command-response";
import { declaredCreateCommandIds, runCreateOperation } from "../host/workbench-create-operation";
import { runWorkspaceWebviewMutation, type WebviewOperationRequest } from "./workspace-webview-mutations";

type CommandMetadata = Pick<WorkbenchExtensionMetadata, "commands"> &
  Partial<Pick<WorkbenchExtensionMetadata, "kanbanRenderers" | "keybindings">>;

export const runWorkbenchWebviewCommandOperation = async (input: {
  workbench: WorkbenchCore;
  projectId: string;
  resource?: ResourceRef;
  request: WebviewOperationRequest;
  metadata?: CommandMetadata;
  signal?: AbortSignal;
  execute(signal?: AbortSignal): Promise<unknown>;
}) => {
  const { request, metadata, projectId, workbench } = input;
  let response: unknown;
  const execute = async (signal?: AbortSignal) => {
    response = await input.execute(signal);
    return response;
  };
  try {
    if (["create", "rename", "delete"].some((action) => request.commandId === `pstdio.workspaces.command.${action}`))
      return await runWorkspaceWebviewMutation({ ...input, execute });
    const command = metadata?.commands.find((record) => record.id === request.commandId);
    if (!command || !metadata || !declaredCreateCommandIds(metadata).has(command.id))
      return await execute(input.signal);
    return await runCreateOperation(
      getWorkbenchOperations(getWorkbenchQueries(workbench)),
      projectId,
      command,
      request.params,
      async (operationSignal) => {
        const signal = input.signal ? AbortSignal.any([operationSignal, input.signal]) : operationSignal;
        signal.throwIfAborted();
        const result = await execute(signal);
        unwrapCommandValue(result);
        return result;
      },
    );
  } catch (error) {
    if (error instanceof UnresolvedSubmissionError)
      return {
        outcome: { ok: false, status: "error", code: "resource_create_unconfirmed", reason: error.message },
      };
    if (error instanceof CommandOutcomeError && response !== undefined) return response;
    throw error;
  }
};
