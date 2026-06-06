import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import type { HostCapabilityRegistry } from "../../bridge/contract";
import { createExtensionSlot, toExtensionCommandResource } from "../host/workbench-extension-command";
import type { CreateBridgeWebviewHostCapabilities } from "./bridge-webview-renderer";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

type ExtensionWebviewSlotKind = NonNullable<CommandExecuteRequest["slot"]>["kind"];

export interface ExtensionWebviewFileCapabilities {
  delete(params: unknown): Promise<unknown> | unknown;
  list(params: unknown): Promise<unknown> | unknown;
  upload(params: unknown): Promise<unknown> | unknown;
}

interface CreateExtensionWebviewHostCapabilitiesInput {
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

export const createExtensionWebviewHostCapabilities =
  (input: CreateExtensionWebviewHostCapabilitiesInput): CreateBridgeWebviewHostCapabilities =>
  (context) => {
    const base = createWorkbenchWebviewHostCapabilities({ workbench: context.workbench });

    return {
      ...base,
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
            context: { contributionId: context.webviewId },
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
    } satisfies HostCapabilityRegistry;
  };
