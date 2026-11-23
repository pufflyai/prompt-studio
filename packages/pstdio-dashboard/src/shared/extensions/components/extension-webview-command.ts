import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommandResponse,
  runWorkbenchWebviewCommandOperation,
} from "@pstdio/workbench/extensions";

interface ExtensionCommandInput {
  commandId: string;
  params?: Record<string, unknown>;
  resource?: ResourceRef;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  slot?: import("@pstdio/sdk/api").CommandExecuteRequest["slot"];
}
interface ExecuteWebviewCommandInput extends ExtensionCommandInput {
  placement?: PlacementIdentity;
  isViewerCurrent?(): boolean;
  executeExtensionCommand: (input: ExtensionCommandInput, signal?: AbortSignal) => Promise<unknown>;
  declarations?: Parameters<typeof runWorkbenchWebviewCommandOperation>[0]["metadata"];
  signal?: AbortSignal;
  workbench?: WorkbenchCore;
  projectId?: string;
}
export const executeWebviewCommand = async (input: ExecuteWebviewCommandInput) => {
  const { commandId, executeExtensionCommand, metadata, params, workspaceId, resource, slot, workbench } = input;
  if (input.isViewerCurrent?.() === false) throw new Error("The calling viewer is no longer open");
  const isExtensionCommand = commandId.includes(".command.");
  if (!isExtensionCommand && workbench?.commands.getCommand(commandId)) {
    const value = await workbench.commands.executeCommand(commandId, params, {
      resource,
      signal: input.signal,
      placement: input.placement,
      projectId: input.projectId,
      isViewerCurrent: input.isViewerCurrent,
    });
    return { commandId, extensionId: "pstdio", eventIds: [], outcome: { ok: true, status: "success", value } };
  }
  const execute = (signal?: AbortSignal) =>
    executeExtensionCommand({ commandId, metadata, params, workspaceId, resource, ...(slot ? { slot } : {}) }, signal);
  const projectId = input.projectId;
  if (workbench && projectId) {
    return runWorkbenchWebviewCommandOperation({
      workbench,
      projectId,
      resource,
      request: { commandId, params, resource },
      metadata: input.declarations,
      signal: input.signal,
      execute: (signal) =>
        executeWorkbenchExtensionCommandResponse(
          { projectId, workbench, executeCommand: (_ignoredId, _ignoredBody, commandSignal) => execute(commandSignal) },
          commandId,
          { placement: input.placement, signal, isViewerCurrent: input.isViewerCurrent },
        ),
    });
  }
  return execute(input.signal);
};

export const webviewCommandSlot = (input: {
  projectId?: string;
  webviewId: string;
  slotKind?: "panel" | "settings";
}) =>
  input.projectId
    ? createExtensionSlot({
        id: input.webviewId,
        kind: input.slotKind ?? "panel",
        projectId: input.projectId,
        context: { panelId: input.webviewId },
      })
    : undefined;
