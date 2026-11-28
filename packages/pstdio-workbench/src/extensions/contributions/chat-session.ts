import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot, ControlValueMap } from "@pstdio/sdk/extensions";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { chatRendererSnapshotSchema } from "pstdio-api-contracts";
import { type ChatActionOperations, executeChatAction, trackChatActionExecution } from "./chat-action-operations";
import { createChatDraftRestoration, hasUnresolvedChatSubmission } from "./chat-draft-restoration";
import { createChatEventReader } from "./chat-event-reader";
import { returnFailedChatInput } from "./chat-failed-submission";
import { type ChatQueryContext, createChatFiniteRead } from "./chat-finite-read";
import { type ChatPendingSubmission, createChatSubmissionPresentation } from "./chat-pending-submission";
import { createChatSessionDraft } from "./chat-session-draft";
import { watchChatSession } from "./chat-session-watch";
import { createChatSnapshot } from "./chat-snapshot";
import { createChatProjection } from "./chat-stream-paint";
import { createChatSubmissionRunner, type TrackChatSubmission } from "./chat-submission";
import { createChatSubmissionHandoff } from "./chat-submission-handoff";

export interface ChatSessionInput {
  initial?: ChatRendererSnapshot;
  actionOperations?: ChatActionOperations;
  trackSubmission?: TrackChatSubmission;
  hasRetainedSubmission?: () => boolean;
  subscribeSubmissions?: (listener: () => void) => () => void;
  inspectResources?: () => void;
  queryContext?: ChatQueryContext;
  onIdle?(): void;
  captureSaveDraft?(): (draft: ChatDraft) => Promise<unknown>;
  captureWork?(): <T>(run: () => Promise<T>) => Promise<T>;
  query(signal: AbortSignal, values: ControlValueMap): Promise<unknown>;
  action(action: ChatRendererAction): Promise<unknown>;
  watch?(signal: AbortSignal): AsyncIterable<unknown> & { result?: Promise<unknown> };
  loadDraft?(): Promise<unknown>;
  saveDraft?(draft: ChatDraft): Promise<unknown>;
  /** Keep each edit synchronously, before the asynchronous save settles. */
  stageDraft?(draft: ChatDraft): void;
}

/** A provider draft replaces the composer only when nobody typed while the action ran. */
const applyChatActionDraft = (
  drafts: ReturnType<typeof createChatSessionDraft>,
  incoming: ChatDraft | undefined,
  expectedEdits: number,
  capturedSave?: ChatSessionInput["saveDraft"],
) => {
  if (incoming && drafts.edits() === expectedEdits) drafts.change(incoming, capturedSave);
};

const initialChatState = (initial?: ChatRendererSnapshot) => ({
  conversation: {
    ...chatRendererSnapshotSchema.parse(initial ?? {}),
    ...(initial?.decisions && !initial.decision ? { decision: initial.decisions[0] ?? null } : {}),
  },
  draft: { text: "", attachments: [], values: { ...initial?.values } } as ChatDraft,
  messages: (initial?.messages ?? []) as SessionMessage[],
  historyMessages: (initial?.messages ?? []) as SessionMessage[],
  queuedFollowUps: initial?.queuedFollowUps ?? [],
  pending: undefined as ChatPendingSubmission[] | undefined,
  loading: false,
  initializing: true,
  sending: false,
  error: undefined as string | undefined,
  canRefreshError: false,
});

const projectChatState = (
  state: ReturnType<typeof initialChatState>,
  update: Partial<ReturnType<typeof initialChatState>>,
  present: ReturnType<typeof createChatSubmissionPresentation>,
) => {
  const next = { ...state, ...(Object.hasOwn(update, "error") ? { canRefreshError: false } : {}), ...update };
  const unchanged =
    next.conversation.messages === state.conversation.messages &&
    next.conversation.queuedFollowUps === state.conversation.queuedFollowUps &&
    next.pending === state.pending;
  return unchanged
    ? next
    : { ...next, ...present(next.conversation.messages ?? [], next.pending, next.conversation.queuedFollowUps) };
};

const failChatAction = (fail: (error: unknown) => void, action: ChatRendererAction) => (error: unknown) => {
  // The per-message Fork control owns its failure; reconnecting the transcript cannot retry it.
  if (action.type !== "fork") fail(error);
  throw error;
};

const trackChatAction = <T>(
  actions: Set<Promise<unknown>>,
  running: Promise<T>,
  release: () => void,
  idle?: () => void,
) => {
  actions.add(running);
  const settled = () => {
    actions.delete(running);
    release();
    idle?.();
  };
  void running.then(settled, settled);
  return running;
};

const isTranscriptUpdate = (loaded: boolean, incoming: ChatRendererSnapshot) =>
  loaded && incoming.messages !== undefined && Object.keys(incoming).length === 1;

const chatErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const refreshFailure = (error: unknown) => ({ error: chatErrorMessage(error), canRefreshError: true });

const chatReadUpdate = <T extends { error?: string }>(update: T, draftError?: string) => {
  const error = draftError ?? update.error;
  return error ? { ...update, ...refreshFailure(error) } : update;
};

const captureChatWatchError =
  (
    read: () => Pick<ReturnType<typeof initialChatState>, "error" | "canRefreshError">,
    revision: () => number,
    publish: (update: Pick<ReturnType<typeof initialChatState>, "error" | "canRefreshError">) => void,
  ) =>
  (error: unknown) => {
    const { error: previous, canRefreshError } = read();
    publish(refreshFailure(error));
    const issued = revision();
    return (cause?: unknown) => {
      if (revision() === issued)
        publish(cause === undefined ? { error: previous, canRefreshError } : refreshFailure(cause));
    };
  };

/** One owner per project/view/resource, shared across page/panel changes. */
export const createChatSession = (input: ChatSessionInput) => {
  let state = initialChatState(input.initial);
  let errorRevision = 0;
  const projection = createChatProjection(state);
  const present = createChatSubmissionPresentation();
  const publish = (update: Partial<typeof state>, transcriptOnly = false) => {
    if (Object.hasOwn(update, "error")) errorRevision++;
    state = projectChatState(state, update, present);
    if (!retired) projection.publish(state, transcriptOnly);
  };
  const fail = (error: unknown) => publish({ error: chatErrorMessage(error) });
  const readState = () => state;
  const failWatch = captureChatWatchError(readState, () => errorRevision, publish);
  let holds = 0;
  let observing = false;
  let controller: AbortController | undefined;
  let generation = 0;
  let clock = 0;
  let hasLoaded = false;
  const snapshots = createChatSnapshot(state.conversation);
  const actions = new Set<Promise<unknown>>();
  let retired = false;
  const retiredState = initialChatState();
  const merge = (
    incoming: ChatRendererSnapshot,
    issued = ++clock,
    expectedValues?: Map<string, number>,
    action?: ChatRendererAction,
    capturedSave?: ChatSessionInput["saveDraft"],
  ) => {
    const pending = state.pending;
    const merged = snapshots.merge(state, incoming, issued, expectedValues, action);
    const transcriptOnly = isTranscriptUpdate(hasLoaded, incoming);
    hasLoaded = true;
    publish({ ...merged.state, loading: false }, transcriptOnly);
    // A failed message arrived after all; take its returned text back out of an unchanged composer.
    const delivered = pending?.find(
      (item) =>
        item.returned?.draftEdits === drafts.edits() &&
        !state.pending?.some((next) => next.message.id === item.message.id),
    );
    if (delivered?.returned) drafts.change(delivered.returned.previous);
    if (expectedValues && merged.valuesChanged) drafts.changed(capturedSave);
  };
  const reader = createChatEventReader({
    reserve: () => ++clock,
    merge,
    messages: () => state.conversation.messages ?? [],
    // An accepted native command can fail later; its input comes back like a failed send.
    recover: (failed) => {
      const returned = returnFailedChatInput(state.draft, failed);
      if (returned !== state.draft) drafts.change(returned);
    },
  });
  const pin = () => (finite.query.isDisposed() ? () => {} : finite.query.subscribe(() => {}, { automatic: false }));
  const drafts = createChatSessionDraft({
    ...input,
    read: () => state.draft,
    publish: (draft) => publish({ draft }),
    values: snapshots.values,
    fail: (error) => publish(refreshFailure(error)),
    clearError: (error) => {
      if (state.error === error) publish({ error: undefined });
    },
    pin,
    idle: () => input.onIdle?.(),
  });
  const finite = createChatFiniteRead({
    context: input.queryContext,
    read: (signal) => input.query(signal, state.draft.values),
    issue: () => ++clock,
    merge,
    loaded: () => hasLoaded,
    publish: (update) => publish(chatReadUpdate(update, drafts.error())),
  });
  const start = () => {
    observing = true;
    controller?.abort();
    controller = new AbortController();
    reader.restart();
    const current = ++generation;
    const signal = controller.signal;
    const active = () => current === generation && !signal.aborted;
    publish({ loading: !hasLoaded, error: drafts.error(), canRefreshError: Boolean(drafts.error()) });
    // Control defaults can commit local ownership. Settle initial values before allowing
    // those effects, while the text composer remains usable during both reads.
    void Promise.all([finite.observe(), drafts.hydrate()]).then(() => {
      if (active()) publish({ initializing: false });
    });
    if (input.watch) void watchChatSession(input.watch, signal, active, reader, failWatch);
    drafts.persist();
  };
  const execute = async (
    action: ChatRendererAction,
    handler = input.action,
    capturedSave?: ChatSessionInput["saveDraft"],
  ) => {
    const issued = ++clock;
    const changed = drafts.edits();
    const expectedValues = snapshots.values.capture();
    const removed = present.captureQueuedRemoval(action, state.pending);
    const result = await executeChatAction(action, handler, state.conversation);
    const pending = removed(state.pending);
    if (pending) publish({ pending });
    if (result.snapshot) merge(result.snapshot, issued, expectedValues, action, capturedSave);
    applyChatActionDraft(drafts, result.draft, changed, capturedSave);
    return result;
  };
  const submit = createChatSubmissionRunner({
    trackSubmission: input.trackSubmission,
    read: () => ({ ...state, edits: drafts.edits(), active: !retired }),
    execute,
    publish: (update) => publish({ ...update, ...(update.sending ? { error: drafts.error() } : {}) }),
    changeDraft: drafts.change,
    fail,
  });
  const run = (action: ChatRendererAction, handler = input.action) => {
    if (retired) return Promise.reject(new Error("Chat authority is closed"));
    const work = input.captureWork?.() ?? (<T>(run: () => Promise<T>) => run());
    const release = pin();
    const capturedSave = input.captureSaveDraft?.();
    const admittedChange = (update: Partial<ChatDraft>) => drafts.change(update, capturedSave);
    const admittedExecute = (action: ChatRendererAction, handler = input.action) =>
      execute(action, handler, capturedSave);
    const running = work<Awaited<ReturnType<typeof execute>> | undefined>(() =>
      action.type === "submit"
        ? submit(action, handler, { execute: admittedExecute, changeDraft: admittedChange }).then(() => undefined)
        : trackChatActionExecution(
            input.actionOperations,
            action,
            state.conversation,
            (next) => admittedExecute(next, handler),
            () => state.conversation.queuedFollowUps ?? [],
          ).catch(failChatAction(fail, action)),
    );
    return trackChatAction(actions, running, release, input.onIdle);
  };
  const stop = () => {
    observing = false;
    generation++;
    controller?.abort();
    reader.reset();
    finite.stop();
  };
  return {
    getSnapshot: () => (retired ? retiredState : state),
    query: finite.query,
    actionOperations: input.actionOperations,
    suspend: stop,
    rebind: () => {
      if (holds && observing) start();
    },
    active: () => holds > 0 || actions.size > 0 || drafts.saving() || hasUnresolvedChatSubmission(state.pending),
    ...projection.subscriptions,
    accept: (event: unknown) => {
      if (!retired) reader.accept(event);
    },
    changeDraft: (update: Partial<ChatDraft>) => {
      if (!retired) drafts.change(update);
    },
    ...createChatSubmissionHandoff(() => state.pending, publish),
    storedDraft: drafts.storedDraft,
    ...createChatDraftRestoration({
      ...input,
      active: () => !retired,
      read: readState,
      publish,
    }),
    run,
    reconnect() {
      finite.query.invalidate();
      if (holds && observing) start();
    },
    reportError: fail,
    dismissError: () => publish({ error: undefined }),
    flushDraft: drafts.flush,
    retain() {
      if (retired) throw new Error("Chat authority is closed");
      if (holds++ === 0 || !observing) start();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (--holds === 0) {
          stop();
          input.onIdle?.();
        }
      };
    },
    retire() {
      retired = true;
      stop();
      projection.retire(retiredState);
      return Promise.allSettled([...actions]).then(() => (drafts.saving() ? drafts.flush() : undefined));
    },
    dispose() {
      stop();
      projection.dispose();
      finite.dispose();
      // Provider hydration remains optional; explicit session disposal can await its final save.
      return Promise.allSettled([...actions]).then(drafts.dispose);
    },
  };
};

export type ChatSession = ReturnType<typeof createChatSession>;
