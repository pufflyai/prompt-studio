import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { WebviewArtifactsReadParams, WebviewHostCapabilityResults } from "pstdio-api-contracts/extension-kernel";
import { createExtensionSlot, executeWorkbenchExtensionCommandResponse } from "../host/workbench-extension-command";
import type { CreateBridgeWebviewHostAdapters } from "./bridge-webview-renderer";
import type { ExtensionWebviewFilesAdapter } from "./extension-webview-host-adapters";
import { createWorkbenchWebviewHostAdapters } from "./webview-host-capabilities";

type ExtensionWebviewSlotKind = NonNullable<CommandExecuteRequest["slot"]>["kind"];
export type ExtensionWebviewFileCapabilities = ExtensionWebviewFilesAdapter;
export interface ExtensionWebviewArtifactCapabilities {
  read(
    params: WebviewArtifactsReadParams,
    context: { webviewId: string },
  ): Promise<WebviewHostCapabilityResults["artifacts.read"]> | WebviewHostCapabilityResults["artifacts.read"];
}
interface CreateWorkbenchExtensionWebviewAdaptersInput {
  artifacts?: ExtensionWebviewArtifactCapabilities;
  executeCommand(commandId: string, body: CommandExecuteRequest, signal?: AbortSignal): Promise<unknown> | unknown;
  extensionIdForWebview(webviewId: string): string | undefined;
  files?: ExtensionWebviewFileCapabilities;
  projectId: string;
  slotKind: ExtensionWebviewSlotKind;
}

export const createWorkbenchExtensionWebviewAdapters =
  (input: CreateWorkbenchExtensionWebviewAdaptersInput): CreateBridgeWebviewHostAdapters =>
  (context) => {
    const extensionId = context.extensionId ?? input.extensionIdForWebview(context.webviewId);
    return {
      ...createWorkbenchWebviewHostAdapters({ ...context, extensionId, projectId: input.projectId }),
      executeCommand: (request, signal) => {
        const resource = request.resource ?? context.placement.resource;
        return executeWorkbenchExtensionCommandResponse({ ...input, workbench: context.workbench }, request.commandId, {
          params: request.params,
          workspaceId: request.workspaceId,
          metadata: request.metadata,
          resource,
          signal,
          slot: createExtensionSlot({
            id: context.webviewId,
            kind: input.slotKind,
            projectId: input.projectId,
            context: { panelId: context.webviewId },
          }),
        });
      },
      files: input.files,
      artifacts: input.artifacts
        ? { read: (params) => input.artifacts!.read(params, { webviewId: context.webviewId }) }
        : undefined,
    };
  };
