import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { CommandOutcomeError, type ResourceRef } from "@pstdio/sdk/extensions";
import { UnresolvedSubmissionError } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { unwrapCommandValue } from "../host/command-response";
import { runWorkbenchCommandOperation } from "../host/workbench-command-operation";
import { declaredCreateCommandIds, runCreateOperation } from "../host/workbench-create-operation";
import { runWorkspaceWebviewMutation, type WebviewOperationRequest } from "./workspace-webview-mutations";

export type WebviewCommandMetadata = Pick<WorkbenchExtensionMetadata, "commands"> &
  Partial<Pick<WorkbenchExtensionMetadata, "views" | "keybindings">>;

export const runWorkbenchWebviewCommandOperation = async (input: {
  workbench: WorkbenchCore;
  projectId: string;
  resource?: ResourceRef;
  request: WebviewOperationRequest;
  metadata?: WebviewCommandMetadata;
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
    if (!command || !metadata) return await execute(input.signal);
    if (!declaredCreateCommandIds(metadata).has(command.id)) {
      if (!command.mutating) return await execute(input.signal);
      input.signal?.throwIfAborted();
      return await runWorkbenchCommandOperation({
        operations: getWorkbenchOperations(getWorkbenchQueries(workbench)),
        projectId,
        command,
        source: input.resource,
        params: request.params,
        async write(signal) {
          const result = await execute(signal);
          unwrapCommandValue(result);
          return result;
        },
      });
    }
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
