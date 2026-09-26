import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";
import { executeWorkbenchExtensionCommandResponse } from "@pstdio/workbench/extensions";

interface ExtensionCommandInput {
  commandId: string;
  params?: Record<string, unknown>;
  resource?: ResourceRef;
  repo?: Record<string, unknown>;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}
interface ExecuteWebviewCommandInput extends ExtensionCommandInput {
  executeExtensionCommand: (input: ExtensionCommandInput) => Promise<unknown>;
  workbench?: WorkbenchCore;
  projectId?: string;
}
export const executeWebviewCommand = (input: ExecuteWebviewCommandInput) => {
  const { commandId, executeExtensionCommand, metadata, params, repo, resource, workbench, workspaceId } = input;
  const isExtensionCommand = commandId.includes(".command.");
  if (!isExtensionCommand && workbench?.commands.getCommand(commandId)) {
    return workbench.commands.executeCommand(commandId, params, { resource });
  }
  const execute = () => executeExtensionCommand({ commandId, metadata, params, repo, resource, workspaceId });
  if (workbench && input.projectId) {
    return executeWorkbenchExtensionCommandResponse(
      { projectId: input.projectId, workbench, executeCommand: execute },
      commandId,
    );
  }
  return execute();
};
