import { commandRefId, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRenderInput } from "../../core";
import type { OperationRecovery } from "../../core/registries/mutations/operation-types";
import { getWorkbenchOperations, resourceOperationSubject } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { runTrackedCreate } from "../host/workbench-create-operation";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import type { createChatCommandBinding } from "./chat-command-binding";
import { createChatDraftPersistence } from "./chat-draft-persistence";
import { transferLegacyChatDraft } from "./chat-legacy-draft";
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
  const queries = input.queries ?? getWorkbenchQueries(render.workbench);
  const submissionSource = source.normalized ?? resource;
  const creating = submissionSource?.type === "session-draft";
  const sending = submissionSource?.type === "session" && view.extensionId === "pstdio.session-browser";
  const operations = creating || sending ? getWorkbenchOperations(queries) : undefined;
  const subject = submissionSource ? resourceOperationSubject(submissionSource) : undefined;
  const findUnresolved = (recovery: readonly OperationRecovery[]) =>
    recovery.find(
      (entry) =>
        entry.domain === "resource.create" &&
        entry.status === "unknown" &&
        entry.source &&
        resourceOperationSubject(entry.source) === subject,
    );
  const session = createChatSession({
    hasRetainedSubmission: operations && (() => Boolean(findUnresolved(operations.getSnapshot().recovery))),
    trackSubmission:
      operations && submissionSource && subject
        ? (action, execute, discard) =>
            runTrackedCreate(
              operations,
              {
                projectId: input.projectId,
                subjects: [subject],
                source: submissionSource,
                title: creating ? "Start session" : "Send message",
                draft: { text: action.text, attachments: action.attachments },
                write: execute,
                onDiscard: discard,
              },
              findUnresolved,
              creating ? "Session creation could not be confirmed." : "Message delivery could not be confirmed.",
            )
        : undefined,
    subscribeSubmissions: operations?.subscribe,
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
    query: (signal) => binding().run(body.queryHandlerId, {}, signal),
    action: (action) => binding().required(body.actionHandlerId, { action }),
    loadDraft: loadDraft ? () => drafts?.loadDraft?.() ?? loadDraft() : undefined,
    saveDraft: body.saveDraftHandlerId ? (draft) => drafts!.saveDraft(draft) : undefined,
    captureSaveDraft: body.saveDraftHandlerId
      ? () => {
          const captured = binding();
          const work = captured.captureRequired();
          return (draft) =>
            work(() => drafts!.saveDraft(draft, (value) => captured.run(body.saveDraftHandlerId!, { draft: value })));
        }
      : undefined,
    stageDraft: body.saveDraftHandlerId ? (draft) => drafts!.stageDraft(draft) : undefined,
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
              params: { renderer, draftKey },
              source: "dashboard",
            },
            signal,
          );
        }
      : undefined,
  });
  drafts = body.saveDraftHandlerId
    ? createChatDraftPersistence({
        key: JSON.stringify([input.chatDraftStorageScope, ...session.query.key.slice(2, 6), key]),
        load: loadDraft,
        save: (draft) => binding().required(body.saveDraftHandlerId!, { draft }),
      })
    : undefined;
  drafts?.restore(session);
  return {
    session,
    queries,
    releaseDrafts: drafts?.dispose,
    isSource: (render: WorkbenchPanelRenderInput) =>
      watchSource?.workbench.views.store === render.workbench.views.store,
  };
};
