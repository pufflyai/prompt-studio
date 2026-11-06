import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { applySessionMessagePatch, type SessionMessage } from "@pstdio/ui/chat-ui";
import {
  chatDraftSchema,
  chatRendererActionResultSchema,
  chatRendererActionSchema,
  chatRendererEventSchema,
  chatRendererSnapshotSchema,
} from "pstdio-api-contracts";
import { hydrateChatDraft, recoverChatDraft, restoreChatDraft } from "./chat-draft-recovery";
import { clearDeliveredChatRecoveries, restoreFailedChatSubmission } from "./chat-failed-submission";
import { type ChatPendingSubmission, createChatSubmissionPresentation } from "./chat-pending-submission";
import { createChatSnapshot } from "./chat-snapshot";
import { createChatSubmissionRunner } from "./chat-submission";

export interface ChatSessionInput {
  initial?: ChatRendererSnapshot;
  query(signal: AbortSignal): Promise<unknown>;
  action(action: ChatRendererAction): Promise<unknown>;
  watch?(signal: AbortSignal): AsyncIterable<unknown> & { result?: Promise<unknown> };
  loadDraft?(): Promise<unknown>;
  saveDraft?(draft: ChatDraft): Promise<unknown>;
}

const emptyChatDraft = (draft: ChatDraft) =>
  !draft.text && !draft.attachments.length && !draft.recovered?.length && !Object.keys(draft.values).length;

const initialChatState = (initial?: ChatRendererSnapshot) => ({
  conversation: {
    ...chatRendererSnapshotSchema.parse(initial ?? {}),
    ...(initial?.decisions && !initial.decision ? { decision: initial.decisions[0] ?? null } : {}),
  },
  draft: { text: "", attachments: [], values: { ...initial?.values } } as ChatDraft,
  messages: (initial?.messages ?? []) as SessionMessage[],
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

const watchChatSession = async (
  watch: NonNullable<ChatSessionInput["watch"]>,
  signal: AbortSignal,
  accept: (event: unknown) => void,
  fail: (error: unknown) => void,
) => {
  try {
    const stream = watch(signal);
    for await (const event of stream) {
      if (signal.aborted) break;
      accept(event);
    }
    await stream.result;
  } catch (error) {
    fail(error);
  }
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
const subscribeChatState = (listeners: Set<() => void>, listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** One owner per project/view/resource, shared across page/panel changes. */
export const createChatSession = (input: ChatSessionInput) => {
  let state = initialChatState(input.initial);
  const listeners = new Set<() => void>();
  const present = createChatSubmissionPresentation();
  const publish = (update: Partial<typeof state>) => {
    state = projectChatState(state, update, present);
    for (const listener of listeners) listener();
  };
  const fail = (error: unknown) => publish({ error: error instanceof Error ? error.message : String(error) });
  let holds = 0;
  let controller: AbortController | undefined;
  let generation = 0;
  let revision = -1;
  let streamHasMessages = false;
  let clock = 0;
  let changes = 0;
  let localEdits = 0;
  let hydrated = !input.loadDraft;
  let hydrating = false;
  let hydration = Promise.resolve();
  const snapshots = createChatSnapshot(state.conversation);
  let save = Promise.resolve();
  let persistedChanges = 0;
  let persistenceError: string | undefined;
  let recoverableDraft: ChatDraft | undefined;
  const merge = (
    incoming: ChatRendererSnapshot,
    issued = ++clock,
    expectedValues?: Map<string, number>,
    action?: ChatRendererAction,
  ) => {
    const pending = state.pending;
    const merged = snapshots.merge(state, incoming, issued, expectedValues, action);
    publish({ ...merged.state, loading: false });
    const recovery = clearDeliveredChatRecoveries(state.draft, pending ?? [], state.pending);
    if (recovery) changeDraft(recovery);
    if (expectedValues && merged.valuesChanged) {
      changes++;
      saveDraft();
    }
  };
  const accept = (value: unknown) => {
    const event = chatRendererEventSchema.parse(value);
    if (event.revision <= revision) return;
    if ("patch" in event && !streamHasMessages)
      throw new Error("A chat stream must send its transcript snapshot before incremental message patches.");
    revision = event.revision;
    if ("recoverDraft" in event) {
      changeDraft(
        recoverChatDraft(
          state.draft,
          event.recoverDraft,
          (changes === 0 && emptyChatDraft(state.draft)) || state.draft === recoverableDraft,
        ),
      );
      recoverableDraft = undefined;
    } else if ("snapshot" in event) {
      if (event.snapshot.messages) streamHasMessages = true;
      merge(event.snapshot);
    } else {
      merge({ messages: applySessionMessagePatch(state.conversation.messages ?? [], event.patch) });
    }
  };
  const saveDraft = () => {
    if (!input.saveDraft || persistedChanges === changes) return;
    save = save
      .then(() => hydration)
      .then(async () => {
        if (!hydrated || persistedChanges === changes) return;
        const savingChanges = changes;
        await input.saveDraft!(state.draft);
        persistedChanges = savingChanges;
        if (state.error === persistenceError) publish({ error: undefined });
        persistenceError = undefined;
      })
      .catch((error) => {
        persistenceError = error instanceof Error ? error.message : String(error);
        fail(error);
      });
  };
  const changeDraft = (update: Partial<ChatDraft>) => {
    const draft = chatDraftSchema.parse({ ...state.draft, ...update });
    changes++;
    localEdits++;
    if (update.values) snapshots.values.replace(state.draft.values, draft.values);
    publish({ draft });
    // Saving follows edits even when the presentation unmounts. A failed save remains visible.
    saveDraft();
  };
  const start = () => {
    controller?.abort();
    controller = new AbortController();
    const current = ++generation;
    const signal = controller.signal;
    revision = -1;
    streamHasMessages = false;
    const queried = ++clock;
    const active = () => current === generation && !signal.aborted;
    publish({ loading: true, error: persistenceError });
    const query = input
      .query(signal)
      .then((value) => {
        if (!active()) return;
        const snapshot = chatRendererSnapshotSchema.parse(value);
        // Protect fields written since this read began, including actions and stream events.
        merge(snapshot, queried);
      })
      .catch((error) => {
        if (active()) {
          publish({ loading: false });
          fail(error);
        }
      });
    if (!hydrated && !hydrating && input.loadDraft) {
      hydrating = true;
      const started = changes;
      hydration = input
        .loadDraft()
        .then((value) => {
          const draft = chatDraftSchema.parse(value);
          hydrated = true;
          const values = snapshots.values.hydrate(state.draft.values, draft.values);
          const hydratedDraft = changes === started ? draft : hydrateChatDraft(state.draft, draft);
          publish({ draft: { ...hydratedDraft, values } });
        })
        .catch((error) => {
          fail(error);
        })
        .finally(() => {
          hydrating = false;
        });
    }
    // Control defaults can commit local ownership. Settle initial values before allowing
    // those effects, while the text composer remains usable during both reads.
    void Promise.all([query, hydration]).then(() => {
      if (active()) publish({ initializing: false });
    });
    if (input.watch)
      void watchChatSession(
        input.watch,
        signal,
        (event) => {
          if (active()) accept(event);
        },
        (error) => {
          if (active()) fail(error);
        },
      );
    saveDraft();
  };
  const execute = async (action: ChatRendererAction, handler = input.action) => {
    assertChatActionAvailable(state.conversation, action);
    const issued = ++clock;
    const changed = localEdits;
    const expectedValues = snapshots.values.capture();
    const parsed = chatRendererActionSchema.parse(action);
    const result = chatRendererActionResultSchema.parse((await handler(parsed)) ?? {});
    if (result.snapshot) merge(result.snapshot, issued, expectedValues, parsed);
    if (result.draft) changeDraft(localEdits === changed ? result.draft : hydrateChatDraft(state.draft, result.draft));
    return result;
  };
  const submit = createChatSubmissionRunner({
    read: () => ({ ...state, edits: localEdits }),
    execute,
    publish: (update) => publish({ ...update, ...(update.sending ? { error: persistenceError } : {}) }),
    changeDraft,
    fail,
    markRecoverable: () => {
      recoverableDraft = state.draft;
    },
  });
  const run = (action: ChatRendererAction, handler = input.action) => {
    if (action.type === "submit") return submit(action, handler);
    return execute(action, handler).catch((error) => {
      fail(error);
      throw error;
    });
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => subscribeChatState(listeners, listener),
    accept,
    changeDraft,
    restoreSubmission(id: string) {
      const restored = restoreFailedChatSubmission(state.draft, state.pending, id);
      if (!restored) return;
      snapshots.values.claim(restored.draft.values);
      changeDraft(restored.draft);
      publish({ pending: restored.pending });
    },
    restoreDraft(index: number) {
      const draft = restoreChatDraft(state.draft, index);
      snapshots.values.claim(draft.values);
      changeDraft(draft);
    },
    run,
    reconnect() {
      if (holds) start();
    },
    reportError: fail,
    flushDraft: () => save,
    retain() {
      if (holds++ === 0) start();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (--holds === 0) {
          generation++;
          controller?.abort();
        }
      };
    },
    dispose() {
      generation++;
      controller?.abort();
      listeners.clear();
    },
  };
};

export type ChatSession = ReturnType<typeof createChatSession>;
