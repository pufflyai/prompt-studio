import type { WorkbenchCore } from "@pstdio/workbench";

interface ExtensionCommandResource {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface ExtensionCommandInput {
  commandId: string;
  params?: Record<string, unknown>;
  resource?: ExtensionCommandResource;
  repo?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface ExecuteWebviewCommandInput extends ExtensionCommandInput {
  executeExtensionCommand: (input: ExtensionCommandInput) => Promise<unknown>;
  workbench?: WorkbenchCore;
}

const toWorkbenchResource = (resource: ExtensionCommandResource | undefined) => {
  if (!resource) return undefined;
  return {
    kind: resource.type,
    uri: `pstdio://extension-resource/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}`,
    id: resource.id,
    label: resource.label,
    metadata: resource.metadata,
  };
};

export const executeWebviewCommand = (input: ExecuteWebviewCommandInput) => {
  const { commandId, executeExtensionCommand, metadata, params, repo, resource, workbench } = input;
  const isExtensionCommand = commandId.includes(".command.");
  if (!isExtensionCommand && workbench?.commands.getCommand(commandId)) {
    return workbench.commands.executeCommand(commandId, params, { resource: toWorkbenchResource(resource) });
  }
  return executeExtensionCommand({ commandId, metadata, params, repo, resource });
};
