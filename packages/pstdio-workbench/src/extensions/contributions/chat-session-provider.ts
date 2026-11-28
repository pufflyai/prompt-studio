import {
  type ChatDraft,
  CommandOutcomeError,
  commandRefId,
  type ResourceRef,
  resourceKey,
} from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRenderInput } from "../../core";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import type { OperationRecovery } from "../../core/registries/mutations/operation-types";
import { getWorkbenchOperations, resourceOperationSubject } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import { runTrackedCreate } from "../host/workbench-create-operation";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import { createChatActionOperations } from "./chat-action-operations";
import { chatBrowserDraftKey } from "./chat-browser-draft-key";
import type { createChatCommandBinding } from "./chat-command-binding";
import { createLocalChatDraft } from "./chat-local-drafts";
import type { ChatRecord } from "./chat-renderer-contributions";
import { type ChatSessionInput, createChatSession } from "./chat-session";

const trackChatSubmissions = (
  queries: ReturnType<typeof getWorkbenchQueries>,
  resource: ResourceRef | undefined,
  extensionId: string,
  projectId: string,
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
          classify: (error) =>
            !creating && error instanceof CommandOutcomeError && error.outcome.error?.name === "HarnessOperationRefused"
              ? "rejected"
              : classifyApiWrite(error),
          write: execute,
          onDiscard: discard,
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
  let watchSource: RegisterWorkbenchExtensionContributionsInput | undefined;
  const queries = input.queries ?? getWorkbenchQueries(render.workbench);
  const localDraft = body.browserDraft
    ? createLocalChatDraft(
        chatBrowserDraftKey(
          input.chatDraftStorageScope,
          { ...queries.getScope(), projectId: input.projectId, extensionId: view.extensionId },
          key,
        ),
        input.chatDraftStorage,
      )
    : undefined;
  const providerSave = !localDraft && body.saveDraftHandlerId;
  const saveProviderDraft = providerSave
    ? (draft: ChatDraft) => binding().required(providerSave, { draft })
    : undefined;
  const session = createChatSession({
    actionOperations:
      sourceResource?.type === "session" && view.extensionId === "pstdio.session-browser"
        ? createChatActionOperations(queries, sourceResource, input.projectId)
        : undefined,
    ...trackChatSubmissions(queries, sourceResource, view.extensionId, input.projectId),
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
    query: (signal, values) => binding().run(body.queryHandlerId, localDraft ? { values } : {}, signal),
    action: (action) => binding().required(body.actionHandlerId, { action }),
    loadDraft: body.loadDraftHandlerId ? () => binding().run(body.loadDraftHandlerId!, {}) : undefined,
    saveDraft: localDraft ? async (draft) => localDraft.save(draft) : saveProviderDraft,
    captureSaveDraft: providerSave
      ? () => {
          const captured = binding();
          const work = captured.captureRequired();
          return (draft) => work(() => captured.run(providerSave, { draft }));
        }
      : undefined,
    stageDraft: localDraft?.save,
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
  const stored = localDraft?.read();
  if (stored) session.storedDraft.restore(stored);
  return {
    session,
    queries,
    releaseDrafts: localDraft?.dispose,
    isSource: (render: WorkbenchPanelRenderInput) =>
      watchSource?.workbench.views.store === render.workbench.views.store,
  };
};
