import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import { hydrateChatDraft } from "./chat-draft-recovery";
import type { ChatSessionInput } from "./chat-session";
import type { createChatSnapshot } from "./chat-snapshot";

export const createChatSessionDraft = (
  input: ChatSessionInput & {
    read: () => ChatDraft;
    publish: (draft: ChatDraft, hydration?: boolean) => void;
    values: ReturnType<typeof createChatSnapshot>["values"];
    fail: (error: unknown) => void;
    clearError: (error: string | undefined) => void;
    pin: () => () => void;
    idle: () => void;
  },
) => {
  let changes = 0,
    edits = 0,
    persisted = 0,
    activeVersion = -1,
    saving = 0;
  let hydrated = !input.loadDraft,
    hydrating = false;
  let hydration = Promise.resolve(),
    save = Promise.resolve();
  let error: string | undefined;
  let draining = false;
  let pending: { version: number; execute: NonNullable<ChatSessionInput["saveDraft"]> } | undefined;
  const stage = () => {
    try {
      input.stageDraft?.(input.read());
    } catch (cause) {
      fail(cause);
    }
  };
  const fail = (cause: unknown) => {
    error = cause instanceof Error ? cause.message : String(cause);
    input.fail(cause);
  };
  const drain = async () => {
    // Restoring the journal can queue a draft before its first presentation starts hydration.
    await Promise.resolve();
    await hydration;
    while (hydrated && pending) {
      const intent = pending;
      pending = undefined;
      activeVersion = intent.version;
      if (persisted === intent.version) continue;
      const release = input.pin();
      saving++;
      try {
        stage();
        await intent.execute(input.read());
        persisted = intent.version;
        input.clearError(error);
        error = undefined;
      } catch (cause) {
        fail(cause);
      } finally {
        activeVersion = -1;
        saving--;
        release();
        input.idle();
      }
    }
  };
  const start = () => {
    if (draining) return;
    draining = true;
    const completion = Promise.withResolvers<void>();
    save = completion.promise;
    const finish = () => {
      if (hydrated && pending) {
        void drain().then(finish, failed);
        return;
      }
      draining = false;
      completion.resolve();
    };
    const failed = (cause: unknown) => {
      fail(cause);
      draining = false;
      completion.resolve();
    };
    void drain().then(finish, failed);
  };
  const persist = (captured?: ChatSessionInput["saveDraft"]) => {
    if ((!input.saveDraft && !input.captureSaveDraft) || persisted === changes || activeVersion === changes) return;
    stage();
    if (pending?.version !== changes)
      pending = { version: changes, execute: captured ?? input.captureSaveDraft?.() ?? input.saveDraft! };
    start();
  };
  return {
    error: () => error,
    edits: () => edits,
    changes: () => changes,
    saving: () => saving > 0,
    persist,
    changed: (captured?: ChatSessionInput["saveDraft"]) => {
      changes++;
      persist(captured);
    },
    change: (update: Partial<ChatDraft>, captured?: ChatSessionInput["saveDraft"]) => {
      const previous = input.read();
      const draft = chatDraftSchema.parse({ ...previous, ...update });
      changes++;
      edits++;
      if (update.values) input.values.replace(previous.values, draft.values);
      input.publish(draft);
      persist(captured);
    },
    hydrate: () => {
      if (!hydrated && !hydrating && input.loadDraft) {
        hydrating = true;
        hydration = input
          .loadDraft()
          .then((value) => {
            const draft = chatDraftSchema.parse(value);
            hydrated = true;
            const current = input.read();
            const values = input.values.hydrate(current.values, draft.values);
            input.publish({ ...(changes === 0 ? draft : hydrateChatDraft(current, draft)), values }, true);
          })
          .catch(input.fail)
          .finally(() => {
            hydrating = false;
          });
      }
      return hydration;
    },
    flush: () => save,
    dispose: () => hydration.then(() => save),
  };
};
