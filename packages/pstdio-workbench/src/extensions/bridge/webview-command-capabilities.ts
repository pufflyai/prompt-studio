import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { ExtensionResourceOpenIntent } from "@pstdio/sdk/extensions";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import {
  createExtensionSlot,
  toExtensionCommandResource,
  toWorkbenchResource,
} from "../host/workbench-extension-command";
import type { CreateBridgeWebviewHostCapabilities } from "./bridge-webview-renderer";
import { createWorkbenchWebviewHostCapabilities, toOpenResourceInput } from "./webview-host-capabilities";

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
  files?: ExtensionWebviewFileCapabilities;
  projectId: string;
  slotKind: ExtensionWebviewSlotKind;
}

type WebviewCommandExecuteParams = {
  commandId: string;
  params?: Record<string, unknown>;
  resource?: CommandExecuteRequest["resource"];
};

type WebviewResourceOpenParams = {
  resource?: CommandExecuteRequest["resource"];
  input?: ExtensionResourceOpenIntent;
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
      // Extension guests speak the SDK resource shape (`type`); normalize to the
      // workbench shape (`kind` + synthesized uri) the resource registry expects,
      // mirroring how commands.execute and tree targets normalize their resources.
      "resource.open": (params) => {
        const request = params as WebviewResourceOpenParams;
        if (!request.resource) throw new Error("resource.open requires a resource.");
        return context.workbench.resources.openResource(
          toWorkbenchResource(request.resource),
          toOpenResourceInput(request.input),
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
