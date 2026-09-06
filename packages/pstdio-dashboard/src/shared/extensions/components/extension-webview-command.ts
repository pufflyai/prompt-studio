import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";

interface ExtensionCommandInput {
  commandId: string;
  params?: Record<string, unknown>;
  resource?: ResourceRef;
  repo?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
interface ExecuteWebviewCommandInput extends ExtensionCommandInput {
  executeExtensionCommand: (input: ExtensionCommandInput) => Promise<unknown>;
  workbench?: WorkbenchCore;
}
export const executeWebviewCommand = (input: ExecuteWebviewCommandInput) => {
  const { commandId, executeExtensionCommand, metadata, params, repo, resource, workbench } = input;
  const isExtensionCommand = commandId.includes(".command.");
  if (!isExtensionCommand && workbench?.commands.getCommand(commandId)) {
    return workbench.commands.executeCommand(commandId, params, { resource });
  }
  return executeExtensionCommand({ commandId, metadata, params, repo, resource });
};
