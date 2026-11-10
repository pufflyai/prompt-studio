import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import {
  chatRendererActionResultSchema,
  chatRendererActionSchema,
  chatRendererSnapshotSchema,
} from "pstdio-api-contracts";
import { createWorkbenchStore } from "../../core/shared/store/workbench-store";
import { chatDraftContentKey, hydrateChatDraft, recoverChatDraft } from "./chat-draft-recovery";
import { createChatDraftRestoration } from "./chat-draft-restoration";
import { createChatEventReader } from "./chat-event-reader";
import { clearDeliveredChatRecoveries } from "./chat-failed-submission";
import { type ChatQueryContext, createChatFiniteRead } from "./chat-finite-read";
import { type ChatPendingSubmission, createChatSubmissionPresentation } from "./chat-pending-submission";
import { createChatSessionDraft } from "./chat-session-draft";
import { watchChatSession } from "./chat-session-watch";
import { createChatSnapshot } from "./chat-snapshot";
import { createChatSubmissionRunner } from "./chat-submission";
import { createChatSubmissionHandoff } from "./chat-submission-handoff";

export interface ChatSessionInput {
  initial?: ChatRendererSnapshot;
  queryContext?: ChatQueryContext;
  onIdle?(): void;
  captureSaveDraft?(): (draft: ChatDraft) => Promise<unknown>;
  captureWork?(): <T>(run: () => Promise<T>) => Promise<T>;
  query(signal: AbortSignal): Promise<unknown>;
  action(action: ChatRendererAction): Promise<unknown>;
  watch?(signal: AbortSignal): AsyncIterable<unknown> & { result?: Promise<unknown> };
  loadDraft?(): Promise<unknown>;
  saveDraft?(draft: ChatDraft): Promise<unknown>;
  /** Stage edits synchronously until the provider acknowledges the asynchronous save. */
  stageDraft?(draft: ChatDraft): void;
}

const executeChatAction = async (
  action: ChatRendererAction,
  handler: ChatSessionInput["action"],
  conversation: ChatRendererSnapshot,
) => {
  assertChatActionAvailable(conversation, action);
  return chatRendererActionResultSchema.parse((await handler(chatRendererActionSchema.parse(action))) ?? {});
};

const emptyChatDraft = (draft: ChatDraft) =>
  !draft.text && !draft.attachments.length && !draft.recovered?.length && !Object.keys(draft.values).length;

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
});

const assertChatActionAvailable = (conversation: ChatRendererSnapshot, action: ChatRendererAction) => {
  if (conversation.readOnly && action.type !== "openResource" && action.type !== "openLink")
    throw new Error("This conversation is read-only.");
  if (conversation.queueReadOnly && action.type === "queue")
    throw new Error("This queue is read-only. Refresh it before editing.");
};

const projectChatState = (
  state: ReturnType<typeof initialChatState>,
  update: Partial<ReturnType<typeof initialChatState>>,
  present: ReturnType<typeof createChatSubmissionPresentation>,
) => {
  const next = { ...state, ...update };
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

const chatErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** One owner per project/view/resource, shared across page/panel changes. */
export const createChatSession = (input: ChatSessionInput) => {
  let state = initialChatState(input.initial);
  let errorRevision = 0;
  const projection = createWorkbenchStore({ name: "workbench.chat", initialState: state });
  const present = createChatSubmissionPresentation();
  const publish = (update: Partial<typeof state>) => {
    if (Object.hasOwn(update, "error")) errorRevision++;
    state = projectChatState(state, update, present);
    if (!retired) projection.setState(state, true, "projectChat");
  };
  const fail = (error: unknown) => publish({ error: chatErrorMessage(error) });
  const failWatch = (error: unknown) => {
    const previous = state.error;
    fail(error);
    const revision = errorRevision;
    return (cause?: unknown) => {
      if (errorRevision === revision) publish({ error: cause === undefined ? previous : chatErrorMessage(cause) });
    };
  };
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
  // Unchanged composer writes may replace the object without creating newer work.
  let recoverableDraft: string | undefined;
  const merge = (
    incoming: ChatRendererSnapshot,
    issued = ++clock,
    expectedValues?: Map<string, number>,
    action?: ChatRendererAction,
    capturedSave?: ChatSessionInput["saveDraft"],
  ) => {
    const pending = state.pending;
    const merged = snapshots.merge(state, incoming, issued, expectedValues, action);
    hasLoaded = true;
    publish({ ...merged.state, loading: false });
    const recovery = clearDeliveredChatRecoveries(state.draft, pending ?? [], state.pending);
    if (recovery.pending !== state.pending) publish({ pending: recovery.pending });
    if (recovery.recovery) changeDraft(recovery.recovery);
    if (expectedValues && merged.valuesChanged) {
      drafts.changed(capturedSave);
    }
  };
  const reader = createChatEventReader({
    reserve: () => ++clock,
    merge,
    messages: () => state.conversation.messages ?? [],
    recover: (recovered) => {
      changeDraft(
        recoverChatDraft(
          state.draft,
          recovered,
          (drafts.changes() === 0 && emptyChatDraft(state.draft)) ||
            chatDraftContentKey(state.draft) === recoverableDraft,
        ),
      );
      recoverableDraft = undefined;
    },
  });
  const accept = reader.accept;
  const pin = () => (finite.query.isDisposed() ? () => {} : finite.query.subscribe(() => {}, { automatic: false }));
  const drafts = createChatSessionDraft({
    ...input,
    read: () => state.draft,
    publish: (draft) => publish({ draft }),
    values: snapshots.values,
    fail,
    clearError: (error) => {
      if (state.error === error) publish({ error: undefined });
    },
    pin,
    idle: () => input.onIdle?.(),
  });
  const changeDraft = drafts.change;
  const finite = createChatFiniteRead({
    context: input.queryContext,
    read: input.query,
    issue: () => ++clock,
    merge,
    loaded: () => hasLoaded,
    publish: (update) => publish({ ...update, ...(drafts.error() ? { error: drafts.error() } : {}) }),
  });
  const start = () => {
    observing = true;
    controller?.abort();
    controller = new AbortController();
    reader.restart();
    const current = ++generation;
    const signal = controller.signal;
    const active = () => current === generation && !signal.aborted;
    publish({ loading: !hasLoaded, error: drafts.error() });
    const query = finite.observe();
    const hydration = drafts.hydrate();
    // Control defaults can commit local ownership. Settle initial values before allowing
    // those effects, while the text composer remains usable during both reads.
    void Promise.all([query, hydration]).then(() => {
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
    const result = await executeChatAction(action, handler, state.conversation);
    if (result.snapshot) merge(result.snapshot, issued, expectedValues, action, capturedSave);
    if (result.draft)
      drafts.change(
        drafts.edits() === changed ? result.draft : hydrateChatDraft(state.draft, result.draft),
        capturedSave,
      );
    return result;
  };
  const submit = createChatSubmissionRunner({
    read: () => ({ ...state, edits: drafts.edits() }),
    execute,
    publish: (update) => publish({ ...update, ...(update.sending ? { error: drafts.error() } : {}) }),
    changeDraft,
    fail,
    markRecoverable: () => {
      recoverableDraft = chatDraftContentKey(state.draft);
    },
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
        : admittedExecute(action, handler).catch(failChatAction(fail, action)),
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
    suspend: stop,
    rebind: () => {
      if (holds && observing) start();
    },
    active: () => holds > 0 || actions.size > 0 || drafts.saving(),
    subscribe: projection.subscribe,
    accept: (event: unknown) => {
      if (!retired) accept(event);
    },
    changeDraft: (update: Partial<ChatDraft>) => {
      if (!retired) changeDraft(update);
    },
    ...createChatSubmissionHandoff(() => state.pending, publish),
    ...createChatDraftRestoration({
      active: () => !retired,
      read: () => state,
      values: snapshots.values,
      changeDraft,
      publish,
    }),
    run,
    reconnect() {
      finite.query.invalidate();
      if (holds && observing) start();
    },
    reportError: fail,
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
      projection.setState(retiredState, true, "retireChat");
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
