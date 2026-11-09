import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { type ChatRendererAction, commandRefId, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { type ChatLinkHandler, parseChatLink } from "@pstdio/ui/chat-ui";
import { chatLinkPresentationSchema } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import { type ComponentType, createElement } from "react";
import { z } from "zod";
import { getWorkbenchRenderers, type WorkbenchCore, type WorkbenchPanelRenderInput } from "../../core";
import type { CommandParamFieldRenderer } from "../../react/command-palette/command-param-field";
import type { NativeChatHostProps } from "../../react/renderers/chat/native-chat-host";
import { NativeChatView } from "../../react/renderers/chat/native-chat-view";
import { executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import { createChatDraftPersistence } from "./chat-draft-persistence";
import { type LegacyChatDraftTransfer, transferLegacyChatDraft } from "./chat-legacy-draft";
import { type ChatSession, createChatSession } from "./chat-session";

export interface ChatCommandTransport {
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
const availableCommandIds = (metadata: WorkbenchExtensionMetadata) =>
  JSON.stringify(metadata.commands.map((command) => command.id).sort());

const createChatRendererOwner = (initialInput: RegisterWorkbenchExtensionContributionsInput, view: ChatRecord) => {
  let input = initialInput;
  const body = view.body;
  let Host: ComponentType<NativeChatHostProps> | undefined;
  const sessions = new Map<
    string,
    {
      session: ChatSession;
      render: WorkbenchPanelRenderInput;
      presentationKey: string;
      releaseDrafts?(): void;
    }
  >();
  const normalizeResource = (resource: ResourceRef | undefined) =>
    resource ? (input.resolveChatResource?.(resource, input.projectId) ?? resource) : undefined;
  const keyFor = (resource: WorkbenchPanelRenderInput["instance"]["resource"]) =>
    JSON.stringify([input.projectId, view.id, resourceKey(normalizeResource(resource)) ?? body.draftKey]);
  const sessionFor = (render: WorkbenchPanelRenderInput) => {
    const resource = render.instance.resource;
    const draftKey = resource?.id ?? body.draftKey;
    const key = keyFor(resource);
    let owner = sessions.get(key);
    if (owner) owner.render = render;
    const binding = () => {
      const current = owner?.render ?? render;
      const resource = current.instance.resource;
      const renderer = {
        rendererId: view.id,
        projectId: input.projectId,
        resource,
        pageParams: current.instance.pageContext?.params,
        modeId: input.workbench.modes.getActiveModeId(),
        invocation: { placement: "visible" },
      };
      const slot = {
        id: view.id,
        kind: "renderer" as const,
        context: { projectId: input.projectId, rendererId: view.id },
      };
      const run = (commandId: string, params: Record<string, unknown>, signal?: AbortSignal) =>
        executeWorkbenchExtensionCommand(input, commandId, {
          params: { renderer, draftKey, ...params },
          resource,
          slot,
          signal,
          placement: current.instance.placementIdentity,
          onViewerReplace: (resource) => {
            const state = owner!.session.getSnapshot();
            const action = params.action as ChatRendererAction | undefined;
            // The command's authorized replacement owns this receipt. Explicit switches,
            // stale results and already displayed targets never inherit another prompt.
            if (
              commandId !== body.actionHandlerId ||
              action?.type !== "submit" ||
              action.questionResponse ||
              !state.pending?.length ||
              state.conversation.messages?.length ||
              sessions.has(keyFor(resource))
            )
              return;
            const target = sessionFor({ ...current, instance: { ...current.instance, resource } });
            owner!.session.transferPending(target.session.receivePending);
            const destination = sessions.get(keyFor(resource))!;
            destination.presentationKey = owner!.presentationKey;
            owner!.presentationKey = crypto.randomUUID();
          },
        });
      return { renderer, slot, run };
    };
    if (!owner) {
      let drafts: ReturnType<typeof createChatDraftPersistence> | undefined;
      const loadDraft = body.loadDraftHandlerId
        ? () =>
            transferLegacyChatDraft(
              () => binding().run(body.loadDraftHandlerId!, {}),
              body.saveDraftHandlerId ? (draft) => drafts!.saveDraft(draft) : undefined,
              body.legacySessionDraft && input.projectId
                ? input.readLegacySessionDraft?.(input.projectId, draftKey)
                : undefined,
            )
        : undefined;
      drafts = body.saveDraftHandlerId
        ? createChatDraftPersistence({
            key,
            load: loadDraft,
            save: (draft) => binding().run(body.saveDraftHandlerId!, { draft }),
          })
        : undefined;
      const session = createChatSession({
        initial: body.initial,
        query: (signal) => binding().run(body.queryHandlerId, {}, signal),
        action: (action) => binding().run(body.actionHandlerId, { action }),
        loadDraft: drafts?.loadDraft ?? loadDraft,
        saveDraft: drafts?.saveDraft,
        stageDraft: drafts?.stageDraft,
        watch: body.stream
          ? (signal) => {
              if (!input.streamChatCommand) throw new Error("This host cannot stream native conversations.");
              const { renderer, slot } = binding();
              return input.streamChatCommand(
                commandRefId(body.stream!),
                {
                  projectId: input.projectId,
                  resource: renderer.resource,
                  slot,
                  params: { renderer, draftKey },
                  source: "dashboard",
                },
                signal,
              );
            }
          : undefined,
      });
      drafts?.restore(session);
      owner = { session, render, presentationKey: crypto.randomUUID(), releaseDrafts: drafts?.dispose };
      sessions.set(key, owner);
    }
    const { session } = owner;
    const { run } = binding();
    const linkHandler: ChatLinkHandler = {
      resolveHref: (candidate) => {
        const link = parseChatLink(candidate, typeof window === "undefined" ? undefined : window.location.origin);
        // Opted-in host links own app validation and native external-tab/icon presentation.
        const hostLink = link?.kind === "page" || (link?.kind === "external" && /^https?:/i.test(link.href));
        if (hostLink && session.getSnapshot().conversation.nativeLinks) return null;
        return link?.kind === "external" || link?.kind === "page" ? link.href : null;
      },
      resolveResource: body.resolveLinkHandlerId
        ? async (candidate) => chatLinkPresentationSchema.parse(await run(body.resolveLinkHandlerId!, { candidate }))
        : undefined,
      resolveImageSource: body.resolveImageHandlerId
        ? async (source) =>
            z
              .string()
              .nullable()
              .parse(await run(body.resolveImageHandlerId!, { source }))
        : undefined,
      open: async (candidate) => {
        await session!.run({ type: "openLink", candidate }, (action) => run(body.actionHandlerId, { action }));
      },
    };
    return {
      session,
      key: owner.presentationKey,
      linkHandler,
      action: (action: Parameters<ChatSession["run"]>[0]) => run(body.actionHandlerId, { action }),
    };
  };
  return {
    register(nextInput: RegisterWorkbenchExtensionContributionsInput) {
      const commandsChanged = availableCommandIds(input.metadata) !== availableCommandIds(nextInput.metadata);
      input = nextInput;
      const registration = input.workbench.views.registerView(
        {
          id: view.id,
          title: text(view.title, view.id),
          icon: view.icon,
          body: {
            kind: "react",
            render: (render) => {
              Host ??= input.createChatHost?.(render.workbench, input.projectId);
              const { session, key, action, linkHandler } = sessionFor(render);
              return createElement(NativeChatView, {
                key,
                Host,
                session,
                action,
                linkHandler,
                conversationKey: key,
                visible: render.visible,
                extensionId: view.extensionId,
                refreshKey: getWorkbenchRenderers(render.workbench).store.getState().refreshKeys[view.id],
                emptyTitle: body.emptyTitle === undefined ? undefined : text(body.emptyTitle),
                emptyDescription: body.emptyDescription === undefined ? undefined : text(body.emptyDescription),
                renderParamField: input.createChatParamField?.(render.workbench),
              });
            },
          },
        },
        { source: "extension", ownerId: view.extensionId },
      );
      // Watches resolve nested commands against their starting runtime. Refresh that runtime
      // when optional tools change while keeping the conversation and its unsent draft.
      if (commandsChanged) for (const { session } of sessions.values()) session.reconnect();
      return registration;
    },
    dispose() {
      for (const { session, releaseDrafts } of sessions.values())
        void session.dispose().then(releaseDrafts, releaseDrafts);
      sessions.clear();
    },
  };
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
  const owners = new Map<string, { declaration: string; owner: ReturnType<typeof createChatRendererOwner> }>();
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
        if (current.get(key) === entry.declaration) continue;
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
        entry = { declaration, owner: createChatRendererOwner(input, view) };
        owners.set(key, entry);
      }
      return entry.owner.register(input);
    },
    dispose() {
      for (const entry of owners.values()) entry.owner.dispose();
      owners.clear();
    },
  };
};
export type ChatRendererOwners = ReturnType<typeof createWorkbenchExtensionChatRendererOwners>;
