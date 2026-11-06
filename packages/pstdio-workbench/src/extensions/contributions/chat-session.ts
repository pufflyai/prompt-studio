import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { applySessionMessagePatch } from "@pstdio/ui/chat-ui";
import {
  chatDraftSchema,
  chatRendererActionResultSchema,
  chatRendererActionSchema,
  chatRendererEventSchema,
  chatRendererSnapshotSchema,
} from "pstdio-api-contracts";
import { hydrateChatDraft, recoverChatDraft, restoreChatDraft } from "./chat-draft-recovery";
import { createChatSnapshot } from "./chat-snapshot";

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

/** One owner per project/view/resource, shared across page/panel changes. */
export const createChatSession = (input: ChatSessionInput) => {
  let state = initialChatState(input.initial);
  const listeners = new Set<() => void>();
  const publish = (update: Partial<typeof state>) => {
    state = { ...state, ...update };
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
  let submission: Promise<void> | undefined;
  let recoverableDraft: ChatDraft | undefined;
  const merge = (
    incoming: ChatRendererSnapshot,
    issued = ++clock,
    expectedValues?: Map<string, number>,
    action?: ChatRendererAction,
  ) => {
    const merged = snapshots.merge(state, incoming, issued, expectedValues, action);
    publish({ ...merged.state, loading: false });
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
      void (async () => {
        try {
          const stream = input.watch!(signal);
          for await (const event of stream) {
            if (!active()) break;
            accept(event);
          }
          await stream.result;
        } catch (error) {
          if (active()) fail(error);
        }
      })();
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
  const run = (action: ChatRendererAction, handler = input.action) => {
    if (action.type === "submit") {
      if (submission) return submission;
      const submitted = localEdits;
      publish({ sending: true, error: persistenceError });
      submission = execute(action, handler)
        .then(() => {
          // A newer draft typed during a slow send must not be cleared by the older request.
          if (!action.questionResponse && localEdits === submitted) {
            changeDraft({ text: "", attachments: [] });
            recoverableDraft = state.draft;
          }
        })
        .catch((error) => {
          fail(error);
          throw error;
        })
        .finally(() => {
          submission = undefined;
          publish({ sending: false });
        });
      return submission;
    }
    return execute(action, handler).catch((error) => {
      fail(error);
      throw error;
    });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    accept,
    changeDraft,
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
