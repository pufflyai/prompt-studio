import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { applySessionMessagePatch } from "@pstdio/ui/chat-ui";
import {
  chatDraftSchema,
  chatRendererActionResultSchema,
  chatRendererActionSchema,
  chatRendererEventSchema,
  chatRendererSnapshotSchema,
} from "pstdio-api-contracts";
import { hydrateChatDraft, restoreChatDraft } from "./chat-draft-recovery";

export interface ChatSessionInput {
  initial?: ChatRendererSnapshot;
  query(signal: AbortSignal): Promise<unknown>;
  action(action: ChatRendererAction): Promise<unknown>;
  watch?(signal: AbortSignal): AsyncIterable<unknown> & { result?: Promise<unknown> };
  loadDraft?(): Promise<unknown>;
  saveDraft?(draft: ChatDraft): Promise<unknown>;
}

/** One owner per project/view/resource, shared across page/panel changes. */
export const createChatSession = (input: ChatSessionInput) => {
  let state = {
    conversation: chatRendererSnapshotSchema.parse(input.initial ?? {}),
    draft: { text: "", attachments: [], values: { ...input.initial?.values } } as ChatDraft,
    loading: false,
    sending: false,
    error: undefined as string | undefined,
  };
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
  const fieldClocks = new Map<string, number>();
  let changes = 0;
  let hydrated = !input.loadDraft;
  let hydrating = false;
  let hydration = Promise.resolve();
  const localValues = new Set<string>();
  let save = Promise.resolve();
  let persistedChanges = 0;
  let persistenceError: string | undefined;
  let submission: Promise<void> | undefined;
  const merge = (incoming: ChatRendererSnapshot, issued = ++clock) => {
    const snapshot = Object.fromEntries(
      Object.entries(incoming).filter(([key]) => {
        if ((fieldClocks.get(key) ?? -1) > issued) return false;
        fieldClocks.set(key, issued);
        return true;
      }),
    ) as ChatRendererSnapshot;
    publish({
      conversation: { ...state.conversation, ...snapshot },
      loading: false,
      draft: {
        ...state.draft,
        values: {
          ...state.draft.values,
          ...snapshot.values,
          ...Object.fromEntries([...localValues].map((key) => [key, state.draft.values[key]])),
        },
      },
    });
  };
  const accept = (value: unknown) => {
    const event = chatRendererEventSchema.parse(value);
    if (event.revision <= revision) return;
    if ("patch" in event && !streamHasMessages)
      throw new Error("A chat stream must send its transcript snapshot before incremental message patches.");
    revision = event.revision;
    if ("snapshot" in event) {
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
    changes++;
    const draft = chatDraftSchema.parse({ ...state.draft, ...update });
    for (const key of Object.keys(update.values ?? {})) localValues.add(key);
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
    void input
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
          if (changes === started) {
            for (const key of Object.keys(draft.values)) localValues.add(key);
            publish({ draft: { ...draft, values: { ...state.draft.values, ...draft.values } } });
          } else publish({ draft: hydrateChatDraft(state.draft, draft) });
        })
        .catch((error) => {
          fail(error);
        })
        .finally(() => {
          hydrating = false;
        });
    }
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
    if (state.conversation.readOnly && action.type !== "openResource" && action.type !== "openLink")
      throw new Error("This conversation is read-only.");
    const issued = ++clock;
    const changed = changes;
    const parsed = chatRendererActionSchema.parse(action);
    const result = chatRendererActionResultSchema.parse((await handler(parsed)) ?? {});
    if (result.snapshot) merge(result.snapshot, issued);
    if (result.draft) changeDraft(changes === changed ? result.draft : hydrateChatDraft(state.draft, result.draft));
    return result;
  };
  const run = (action: ChatRendererAction, handler = input.action) => {
    if (action.type === "submit") {
      if (submission) return submission;
      const submitted = changes;
      publish({ sending: true, error: persistenceError });
      submission = execute(action, handler)
        .then(() => {
          // A newer draft typed during a slow send must not be cleared by the older request.
          if (!action.questionResponse && changes === submitted) changeDraft({ text: "", attachments: [] });
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
      changeDraft(restoreChatDraft(state.draft, index));
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
