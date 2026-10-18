import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";
import { createExtensionSlot, executeWorkbenchExtensionCommandResponse } from "@pstdio/workbench/extensions";

interface ExtensionCommandInput {
  commandId: string;
  params?: Record<string, unknown>;
  resource?: ResourceRef;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  slot?: import("@pstdio/sdk/api").CommandExecuteRequest["slot"];
}
interface ExecuteWebviewCommandInput extends ExtensionCommandInput {
  executeExtensionCommand: (input: ExtensionCommandInput) => Promise<unknown>;
  signal?: AbortSignal;
  workbench?: WorkbenchCore;
  projectId?: string;
}
export const executeWebviewCommand = async (input: ExecuteWebviewCommandInput) => {
  const { commandId, executeExtensionCommand, metadata, params, workspaceId, resource, slot, workbench } = input;
  const isExtensionCommand = commandId.includes(".command.");
  if (!isExtensionCommand && workbench?.commands.getCommand(commandId)) {
    const value = await workbench.commands.executeCommand(commandId, params, { resource, signal: input.signal });
    return { commandId, extensionId: "pstdio", eventIds: [], outcome: { ok: true, status: "success", value } };
  }
  const execute = () =>
    executeExtensionCommand({ commandId, metadata, params, workspaceId, resource, ...(slot ? { slot } : {}) });
  if (workbench && input.projectId) {
    return executeWorkbenchExtensionCommandResponse(
      { projectId: input.projectId, workbench, executeCommand: execute },
      commandId,
    );
  }
  return execute();
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
