import { commandRefId, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRenderInput } from "../../core";
import type { OperationRecovery } from "../../core/registries/mutations/operation-types";
import { getWorkbenchOperations, resourceOperationSubject } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { runTrackedCreate } from "../host/workbench-create-operation";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import { createChatActionOperations } from "./chat-action-operations";
import type { createChatCommandBinding } from "./chat-command-binding";
import { createChatDraftPersistence } from "./chat-draft-persistence";
import { transferLegacyChatDraft } from "./chat-legacy-draft";
import { createLocalChatDrafts } from "./chat-local-drafts";
import type { ChatRecord } from "./chat-renderer-contributions";
import { type ChatSessionInput, createChatSession } from "./chat-session";

const trackChatSubmissions = (
  queries: ReturnType<typeof getWorkbenchQueries>,
  resource: ResourceRef | undefined,
  extensionId: string,
  projectId: string,
  discardRecovered: (key: string) => void,
): Pick<ChatSessionInput, "hasRetainedSubmission" | "trackSubmission" | "subscribeSubmissions"> => {
  if (
    !resource ||
    (resource.type !== "session-draft" && (resource.type !== "session" || extensionId !== "pstdio.session-browser"))
  )
    return {};
  const creating = resource.type === "session-draft";
  const operations = getWorkbenchOperations(queries);
  const subject = resourceOperationSubject(resource);
  const findUnresolved = (recovery: readonly OperationRecovery[]) =>
    recovery.find(
      (entry) => entry.domain === "resource.create" && entry.status === "unknown" && entry.subjects.includes(subject),
    );
  return {
    hasRetainedSubmission: () => Boolean(findUnresolved(operations.getSnapshot().recovery)),
    trackSubmission: (action, execute, discard) =>
      runTrackedCreate(
        operations,
        {
          projectId,
          subjects: [subject],
          source: resource,
          title: creating ? "Start session" : "Send message",
          draft: { text: action.text, attachments: action.attachments },
          write: execute,
          onDiscard: () => {
            const key = discard();
            if (key) discardRecovered(key);
          },
        },
        findUnresolved,
        creating ? "Session creation could not be confirmed." : "Message delivery could not be confirmed.",
      ),
    subscribeSubmissions: operations.subscribe,
  };
};

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
  const sourceResource = source.normalized ?? resource;
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
  const local = Boolean(body.browserDraft);
  const acknowledgeRecovery = body.browserDraft?.acknowledgeRecoveryHandlerId;
  const providerSave = !local && body.saveDraftHandlerId;
  const session = createChatSession({
    actionOperations:
      sourceResource?.type === "session" && view.extensionId === "pstdio.session-browser"
        ? createChatActionOperations(queries, sourceResource, input.projectId)
        : undefined,
    ...trackChatSubmissions(queries, sourceResource, view.extensionId, input.projectId, (key) =>
      localDrafts?.discardRecovery(key),
    ),
    inspectResources: () => render.workbench.commandPalette.open(),
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
        ...(localDrafts?.clientId && { draftClientId: localDrafts.clientId }),
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
    acknowledgeRecovery: acknowledgeRecovery
      ? async (draft) => {
          if (localDrafts?.clientId && localDrafts.contains(draft))
            await binding().required(acknowledgeRecovery, { draft, draftClientId: localDrafts.clientId });
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
              params: { renderer, draftKey, ...(localDrafts?.clientId && { draftClientId: localDrafts.clientId }) },
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
    releaseDrafts: localDrafts?.dispose ?? drafts?.dispose,
    draftClientId: localDrafts?.clientId,
    isSource: (render: WorkbenchPanelRenderInput) =>
      watchSource?.workbench.views.store === render.workbench.views.store,
  };
};
