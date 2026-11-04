import type { ChatDraft, ChatRendererAction, ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { applySessionMessagePatch } from "@pstdio/ui/chat-ui";
import {
  chatDraftSchema,
  chatRendererActionResultSchema,
  chatRendererActionSchema,
  chatRendererEventSchema,
  chatRendererSnapshotSchema,
} from "pstdio-api-contracts";

export interface ChatSessionInput {
  initial?: ChatRendererSnapshot;
  query(signal: AbortSignal): Promise<unknown>;
  action(action: ChatRendererAction): Promise<unknown>;
  watch?(signal: AbortSignal): AsyncIterable<unknown>;
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
  let streamed = new Set<keyof ChatRendererSnapshot>();
  let changes = 0;
  let hydrated = false;
  let save = Promise.resolve();
  let submission: Promise<void> | undefined;
  const merge = (snapshot: ChatRendererSnapshot) =>
    publish({
      conversation: { ...state.conversation, ...snapshot },
      loading: false,
      draft: { ...state.draft, values: { ...snapshot.values, ...state.draft.values } },
    });
  const accept = (value: unknown) => {
    const event = chatRendererEventSchema.parse(value);
    if (event.revision <= revision) return;
    if ("patch" in event && !streamed.has("messages"))
      throw new Error("A chat stream must send its transcript snapshot before incremental message patches.");
    revision = event.revision;
    if ("snapshot" in event) {
      for (const key of Object.keys(event.snapshot) as (keyof ChatRendererSnapshot)[]) streamed.add(key);
      merge(event.snapshot);
    } else {
      streamed.add("messages");
      merge({ messages: applySessionMessagePatch(state.conversation.messages ?? [], event.patch) });
    }
  };
  const changeDraft = (update: Partial<ChatDraft>) => {
    changes++;
    const draft = chatDraftSchema.parse({ ...state.draft, ...update });
    publish({ draft });
    // Saving follows edits even when the presentation unmounts. A failed save remains visible.
    if (input.saveDraft)
      save = save
        .then(() => input.saveDraft!(draft))
        .then(() => undefined)
        .catch(fail);
  };
  const start = () => {
    controller?.abort();
    controller = new AbortController();
    const current = ++generation;
    const signal = controller.signal;
    revision = -1;
    streamed = new Set();
    const active = () => current === generation && !signal.aborted;
    publish({ loading: true, error: undefined });
    void input
      .query(signal)
      .then((value) => {
        if (!active()) return;
        const snapshot = chatRendererSnapshotSchema.parse(value);
        // A notice/control chunk does not supersede transcript hydration. Protect each field independently.
        merge(
          Object.fromEntries(
            Object.entries(snapshot).filter(([key]) => !streamed.has(key as keyof ChatRendererSnapshot)),
          ),
        );
      })
      .catch((error) => {
        if (active()) {
          publish({ loading: false });
          fail(error);
        }
      });
    if (!hydrated && input.loadDraft) {
      const started = changes;
      void input
        .loadDraft()
        .then((value) => {
          if (!active()) return;
          const draft = chatDraftSchema.parse(value);
          hydrated = true;
          if (changes === started) publish({ draft });
        })
        .catch((error) => {
          if (active()) fail(error);
        });
    }
    if (input.watch)
      void (async () => {
        try {
          for await (const event of input.watch!(signal)) {
            if (!active()) break;
            accept(event);
          }
        } catch (error) {
          if (active()) fail(error);
        }
      })();
  };
  const execute = async (action: ChatRendererAction, handler = input.action) => {
    if (state.conversation.readOnly && action.type !== "openResource")
      throw new Error("This conversation is read-only.");
    const parsed = chatRendererActionSchema.parse(action);
    const result = chatRendererActionResultSchema.parse((await handler(parsed)) ?? {});
    if (result.snapshot) merge(result.snapshot);
    if (result.draft) changeDraft(result.draft);
    return result;
  };
  const run = (action: ChatRendererAction, handler = input.action) => {
    if (action.type === "submit") {
      if (submission) return submission;
      const submitted = changes;
      publish({ sending: true, error: undefined });
      submission = execute(action, handler)
        .then(() => {
          // A newer draft typed during a slow send must not be cleared by the older request.
          if (changes === submitted) changeDraft({ text: "", attachments: [] });
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
