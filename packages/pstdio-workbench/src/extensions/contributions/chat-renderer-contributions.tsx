import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { ComponentType } from "react";
import type { WorkbenchCore } from "../../core";
import type { CommandParamFieldRenderer } from "../../react/command-palette/command-param-field";
import type { NativeChatHostProps } from "../../react/renderers/chat/native-chat-host";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import type { LegacyChatDraftTransfer } from "./chat-legacy-draft";
import { createChatOwnerRetention } from "./chat-owner-retention";
import { createChatRendererOwner } from "./chat-renderer-owner";

export interface ChatCommandTransport {
  /** Stable runtime endpoint for durable unsent work; authority comes from the common query scope. */
  chatDraftStorageScope?: string;
  /** Normalize host resource defaults for owner selection; invoking placement context stays unchanged. */
  resolveChatResource?(resource: ResourceRef, projectId: string): ResourceRef;
  /** Retain unchanged native owners when the host rebuilds a project contribution set. */
  chatRendererOwners?: ChatRendererOwners;
  readLegacySessionDraft?: (projectId: string, draftKey: string) => LegacyChatDraftTransfer | undefined;
  createChatHost?: (workbench: WorkbenchCore, projectId?: string) => ComponentType<NativeChatHostProps>;
  streamChatCommand?(
    commandId: string,
    body: CommandExecuteRequest,
    signal: AbortSignal,
  ): AsyncIterable<unknown> & { result?: Promise<unknown> };
  createChatParamField?: (workbench: WorkbenchCore) => CommandParamFieldRenderer;
}
export type ChatRecord = WorkbenchExtensionMetadata["views"][number] & {
  body: Extract<WorkbenchExtensionMetadata["views"][number]["body"], { kind: "chat" }>;
};

export const registerWorkbenchExtensionChatRenderers = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const localOwners = input.chatRendererOwners ? undefined : createWorkbenchExtensionChatRendererOwners();
  const owners = input.chatRendererOwners ?? localOwners!;
  const registrations = input.metadata.views.flatMap((view) =>
    view.body.kind === "chat" ? [owners.register(input, view as ChatRecord)] : [],
  );
  return {
    dispose() {
      for (const registration of registrations.reverse()) registration.dispose();
      localOwners?.dispose();
    },
  };
};

const ownerKey = (projectId: string, view: ChatRecord) => JSON.stringify([projectId, view.id]);
const ownerDeclaration = (metadata: WorkbenchExtensionMetadata, view: ChatRecord) =>
  JSON.stringify([metadata.extensions.find((extension) => extension.id === view.extensionId), view]);

/** One project contribution lifecycle owns this collection; registration disposal only detaches views. */
export const createWorkbenchExtensionChatRendererOwners = () => {
  const retention = createChatOwnerRetention();
  const owners = new Map<
    string,
    { projectId: string; declaration: string; owner: ReturnType<typeof createChatRendererOwner> }
  >();
  const trim = () => {
    const inactive = [...owners].filter(([, entry]) => !entry.owner.active());
    for (const [key, entry] of inactive.slice(0, Math.max(0, inactive.length - 128))) {
      owners.delete(key);
      entry.owner.dispose();
    }
  };
  return {
    reconcile(projectId: string, metadata: WorkbenchExtensionMetadata) {
      const current = new Map(
        metadata.views.flatMap((view) =>
          view.body.kind === "chat"
            ? [[ownerKey(projectId, view as ChatRecord), ownerDeclaration(metadata, view as ChatRecord)]]
            : [],
        ),
      );
      for (const [key, entry] of owners) {
        if (entry.projectId !== projectId || current.get(key) === entry.declaration) continue;
        entry.owner.dispose();
        owners.delete(key);
      }
    },
    register(input: RegisterWorkbenchExtensionContributionsInput, view: ChatRecord) {
      const key = ownerKey(input.projectId, view);
      const declaration = ownerDeclaration(input.metadata, view);
      let entry = owners.get(key);
      if (entry?.declaration !== declaration) {
        entry?.owner.dispose();
        entry = { projectId: input.projectId, declaration, owner: createChatRendererOwner(input, view, retention) };
        owners.set(key, entry);
      }
      owners.delete(key);
      owners.set(key, entry);
      const registration = entry.owner.register(input);
      trim();
      return {
        dispose() {
          registration.dispose();
          trim();
        },
      };
    },
    dispose() {
      for (const entry of owners.values()) entry.owner.dispose();
      owners.clear();
      retention.dispose();
    },
  };
};
export type ChatRendererOwners = ReturnType<typeof createWorkbenchExtensionChatRendererOwners>;
