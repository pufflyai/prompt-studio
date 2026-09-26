import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { NavigationTarget, WebviewCommandsExecuteParams } from "@pstdio/sdk/extensions";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import { createExtensionSlot, executeWorkbenchExtensionCommandResponse } from "../host/workbench-extension-command";
import type { CreateBridgeWebviewHostCapabilities } from "./bridge-webview-renderer";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

type ExtensionWebviewSlotKind = NonNullable<CommandExecuteRequest["slot"]>["kind"];
export interface ExtensionWebviewFileCapabilities {
  delete(params: unknown): Promise<unknown> | unknown;
  list(params: unknown): Promise<unknown> | unknown;
  upload(params: unknown): Promise<unknown> | unknown;
}
export interface ExtensionWebviewArtifactCapabilities {
  read(
    params: unknown,
    context: {
      webviewId: string;
    },
  ): Promise<unknown> | unknown;
}
interface CreateExtensionWebviewHostCapabilitiesInput {
  artifacts?: ExtensionWebviewArtifactCapabilities;
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  extensionIdForWebview(webviewId: string): string | undefined;
  files?: ExtensionWebviewFileCapabilities;
  projectId: string;
  slotKind: ExtensionWebviewSlotKind;
}
export const createExtensionWebviewHostCapabilities =
  (input: CreateExtensionWebviewHostCapabilitiesInput): CreateBridgeWebviewHostCapabilities =>
  (context) => {
    const base = createWorkbenchWebviewHostCapabilities({
      workbench: context.workbench,
      placement: context.placement,
      hostEvents: context.hostEvents,
    });
    return {
      ...base,
      "navigation.open": (params) => {
        const request = params as {
          target?: NavigationTarget;
        };
        if (!request.target) throw new Error("navigation.open requires a target.");
        return context.workbench.navigation.openTarget(
          toWorkbenchNavigationTarget(request.target, {
            extensionId: input.extensionIdForWebview(context.webviewId),
            projectId: input.projectId,
          }),
        );
      },
      "commands.execute": async (params) => {
        const request = params as WebviewCommandsExecuteParams;
        const resource = request.resource ?? context.placement.resource;
        return executeWorkbenchExtensionCommandResponse({ ...input, workbench: context.workbench }, request.commandId, {
          ...(request.params ? { params: request.params } : {}),
          ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
          ...(request.metadata ? { metadata: request.metadata } : {}),
          ...(resource ? { resource } : {}),
          slot: createExtensionSlot({
            id: context.webviewId,
            kind: input.slotKind,
            projectId: input.projectId,
            context: { panelId: context.webviewId },
          }),
        });
      },
      ...(input.files
        ? {
            "files.upload": input.files.upload,
            "files.list": input.files.list,
            "files.delete": input.files.delete,
          }
        : {}),
      ...(input.artifacts
        ? {
            // The image-url grant is bound to the requesting webview, so the host
            // resolves the webview id instead of trusting the guest to name one.
            "artifacts.read": (params: unknown) => input.artifacts!.read(params, { webviewId: context.webviewId }),
          }
        : {}),
    } satisfies HostCapabilityRegistry;
  };
