import { commandRefId, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRenderInput } from "../../core";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import type { createChatCommandBinding } from "./chat-command-binding";
import { createChatDraftPersistence } from "./chat-draft-persistence";
import { transferLegacyChatDraft } from "./chat-legacy-draft";
import { createLocalChatDrafts } from "./chat-local-drafts";
import type { ChatRecord } from "./chat-renderer-contributions";
import { createChatSession } from "./chat-session";

export const createChatSessionProvider = (source: {
  input: () => RegisterWorkbenchExtensionContributionsInput;
  view: ChatRecord;
  render: WorkbenchPanelRenderInput;
  key: string;
  draftKey: string;
  normalized?: ResourceRef;
  binding: () => ReturnType<typeof createChatCommandBinding>;
  idle: () => void;
}) => {
  const input = source.input(),
    { view, render, key, draftKey, binding } = source,
    body = view.body;
  const resource = render.instance.resource;
  let drafts: ReturnType<typeof createChatDraftPersistence> | undefined;
  let watchSource: RegisterWorkbenchExtensionContributionsInput | undefined;
  const readLegacy = () =>
    body.legacySessionDraft && input.projectId ? input.readLegacySessionDraft?.(input.projectId, draftKey) : undefined;
  const loadDraft = body.loadDraftHandlerId
    ? () =>
        transferLegacyChatDraft(
          () => binding().run(body.loadDraftHandlerId!, {}),
          body.saveDraftHandlerId ? (draft) => drafts!.saveDraft(draft) : undefined,
          readLegacy(),
        )
    : undefined;
  const queries = input.queries ?? getWorkbenchQueries(render.workbench);
  // A Sessions view without a provider loader stores its composer in this browser.
  const local = body.legacySessionDraft && !loadDraft;
  const providerSave = !local && body.saveDraftHandlerId;
  const session = createChatSession({
    queryContext: {
      queries,
      scope: { projectId: input.projectId, extensionId: view.extensionId },
      descriptor: {
        id: `chat:${view.id}`,
        resourceKey: resourceKey(source.normalized) ?? draftKey,
        dependsOn: body.refreshEventIds,
        dependency: { resourceId: resource?.id },
      },
    },
    onIdle: source.idle,
    captureWork: () => binding().captureRequired(),
    initial: body.initial,
    query: (signal, values) => binding().run(body.queryHandlerId, local ? { values } : {}, signal),
    action: (action) =>
      binding().required(body.actionHandlerId, {
        action,
        ...(localDrafts && { draftClientId: localDrafts.clientId }),
      }),
    loadDraft: loadDraft ? () => drafts?.loadDraft?.() ?? loadDraft() : undefined,
    saveDraft:
      local || providerSave
        ? async (draft) => {
            if (localDrafts) localDrafts.save(draft);
            else await drafts!.saveDraft(draft);
          }
        : undefined,
    captureSaveDraft: providerSave
      ? () => {
          const captured = binding();
          const work = captured.captureRequired();
          return (draft) =>
            work(() => drafts!.saveDraft(draft, (value) => captured.run(providerSave, { draft: value })));
        }
      : undefined,
    stageDraft:
      local || providerSave
        ? (draft) => {
            if (localDrafts) localDrafts.save(draft);
            else drafts!.stageDraft(draft);
          }
        : undefined,
    acknowledgeRecovery:
      local && body.saveDraftHandlerId
        ? async (draft) => {
            if (localDrafts!.contains(draft))
              await binding().required(body.saveDraftHandlerId!, { draft, draftClientId: localDrafts!.clientId });
          }
        : undefined,
    watch: body.stream
      ? (signal) => {
          const input = source.input();
          watchSource = input;
          if (!input.streamChatCommand) throw new Error("This host cannot stream native conversations.");
          const { renderer, slot } = binding();
          return input.streamChatCommand(
            commandRefId(body.stream!),
            {
              projectId: input.projectId,
              resource: renderer.resource,
              slot,
              params: { renderer, draftKey, ...(localDrafts && { draftClientId: localDrafts.clientId }) },
              source: "dashboard",
            },
            signal,
          );
        }
      : undefined,
  });
  const storageKey = JSON.stringify([input.chatDraftStorageScope, ...session.query.key.slice(2, 6), key]);
  const localDrafts = local ? createLocalChatDrafts(storageKey, readLegacy) : undefined;
  drafts = providerSave
    ? createChatDraftPersistence({
        key: storageKey,
        load: loadDraft,
        save: (draft) => binding().required(providerSave, { draft }),
      })
    : undefined;
  localDrafts?.restore(session);
  drafts?.restore(session);
  return {
    session,
    queries,
    releaseDrafts: drafts?.dispose,
    draftClientId: localDrafts?.clientId,
    isSource: (render: WorkbenchPanelRenderInput) =>
      watchSource?.workbench.views.store === render.workbench.views.store,
  };
};
