import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import { createExtensionSlot, toExtensionCommandResource } from "../host/workbench-extension-command";
import type { CreateBridgeWebviewHostCapabilities } from "./bridge-webview-renderer";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

type ExtensionWebviewSlotKind = NonNullable<CommandExecuteRequest["slot"]>["kind"];

export interface ExtensionWebviewFileCapabilities {
  delete(params: unknown): Promise<unknown> | unknown;
  list(params: unknown): Promise<unknown> | unknown;
  upload(params: unknown): Promise<unknown> | unknown;
}

export interface ExtensionWebviewArtifactCapabilities {
  read(params: unknown, context: { webviewId: string }): Promise<unknown> | unknown;
}

interface CreateExtensionWebviewHostCapabilitiesInput {
  artifacts?: ExtensionWebviewArtifactCapabilities;
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  extensionIdForWebview(webviewId: string): string | undefined;
  files?: ExtensionWebviewFileCapabilities;
  projectId: string;
  slotKind: ExtensionWebviewSlotKind;
}

type WebviewCommandExecuteParams = {
  commandId: string;
  params?: Record<string, unknown>;
  resource?: CommandExecuteRequest["resource"];
};

export const createExtensionWebviewHostCapabilities =
  (input: CreateExtensionWebviewHostCapabilitiesInput): CreateBridgeWebviewHostCapabilities =>
  (context) => {
    const base = createWorkbenchWebviewHostCapabilities({
      workbench: context.workbench,
      hostEvents: context.hostEvents,
    });

    return {
      ...base,
      "navigation.open": (params) => {
        const request = params as { target?: NavigationTarget };
        if (!request.target) throw new Error("navigation.open requires a target.");
        return context.workbench.navigation.openTarget(
          toWorkbenchNavigationTarget(request.target, {
            extensionId: input.extensionIdForWebview(context.webviewId),
          }),
        );
      },
      "commands.execute": async (params) => {
        const request = params as WebviewCommandExecuteParams;
        const resource = request.resource ?? toExtensionCommandResource(context.placement.resource);

        return input.executeCommand(request.commandId, {
          projectId: input.projectId,
          ...(request.params ? { params: request.params } : {}),
          ...(resource ? { resource } : {}),
          slot: createExtensionSlot({
            id: context.webviewId,
            kind: input.slotKind,
            projectId: input.projectId,
            context: { panelId: context.webviewId },
          }),
          source: "dashboard",
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
