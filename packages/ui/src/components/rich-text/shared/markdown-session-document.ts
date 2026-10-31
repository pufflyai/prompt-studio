import type { TextEditingDraft, TextEditingSession } from "@pstdio/sdk/extensions";
import { diffChars } from "diff";
import * as Y from "yjs";
import { createMarkdownTextDocument } from "./markdown-text-document";

type Origin = "remote" | "history" | "composition" | "edit" | "reset";
const clone = (document: Y.Doc) => {
  const result = new Y.Doc({ gc: false });
  Y.applyUpdate(result, Y.encodeStateAsUpdate(document));
  return result;
};

/** The public session owns transport and drafts; this owns only rendered history and IME presentation. */
export const createMarkdownSessionDocument = (session: TextEditingSession, beforeReceive?: () => void) => {
  const listeners = new Set<(source: string, origin: Origin) => void>();
  const recoveryListeners = new Set<() => void>();
  let historyId = session.getSnapshot().historyId;
  let draftHistory = historyId;
  let draft: TextEditingDraft | undefined;
  let preview: Y.Doc | undefined;
  let finishing: Promise<void> | undefined;
  let failure: unknown;
  let binding = createMarkdownTextDocument(session.getSnapshot().text.doc!, undefined, session.origin);
  const publish = (source: string, origin: Origin) => {
    for (const listener of listeners) listener(source, origin);
  };
  const changed = () => {
    for (const listener of recoveryListeners) listener();
  };
  const subscribe = () =>
    binding.subscribe((source, origin) => {
      if (!draft && !preview) publish(source, origin);
    });
  let stopBinding = subscribe();
  const stopSession = session.subscribe(() => {
    const state = session.getSnapshot();
    if (state.historyId === historyId) return;
    stopBinding();
    binding.destroy();
    historyId = state.historyId;
    binding = createMarkdownTextDocument(state.text.doc!, undefined, session.origin);
    stopBinding = subscribe();
    if (!draft && !preview) publish(binding.text.toString(), "reset");
  });
  const finish = () => {
    if (!draft) return;
    if (finishing) return finishing;
    const original = draft;
    const state = session.getSnapshot();
    const canDrain =
      state.editable &&
      (!state.error ||
        state.error.retryable ||
        state.error.code === "draft_active" ||
        state.error.code === "projection_failed");
    if (!preview && draftHistory === historyId && canDrain) {
      // No await separates the history check from promotion. Undo owns the original causal delta once.
      const update = Y.encodeStateAsUpdate(original.text.doc!, Y.encodeStateVector(binding.text.doc!));
      binding.applyLocalUpdate(update);
      if (!original.cancel()) throw new Error("This composition is still waiting to be saved");
      draft = undefined;
      publish(binding.text.toString(), "composition");
      return;
    }
    preview ??= clone(original.text.doc!);
    failure = undefined;
    finishing = Promise.resolve()
      .then(async () => {
        await original.commit();
        // The durable receipt can precede canonical history installation in the public session.
        await session.retry();
        draft = undefined;
        preview!.destroy();
        preview = undefined;
        publish(binding.text.toString(), "reset");
        changed();
      })
      .catch((error: unknown) => {
        failure = error;
        changed();
        throw error;
      })
      .finally(() => {
        finishing = undefined;
      });
    changed();
    return finishing;
  };
  const stopReceive = session.beforeReceive(() => beforeReceive?.());
  const stopClose = session.beforeClose(() => {
    beforeReceive?.();
    if (draft && !preview)
      throw Object.assign(new Error("Finish your current text before closing"), {
        code: "draft_active",
        retryable: false,
      });
    return finish();
  });
  const cancelComposition = () => {
    if (finishing) return false;
    if (!draft) return true;
    if (!draft.cancel()) return false;
    draft = undefined;
    preview?.destroy();
    preview = undefined;
    failure = undefined;
    publish(binding.text.toString(), "reset");
    changed();
    return true;
  };
  return {
    get text() {
      return preview?.getText("content") ?? draft?.text ?? binding.text;
    },
    write(source: string) {
      if (preview) throw new Error("This composition is still waiting to be saved");
      if (!draft) return binding.write(source);
      const text = draft.text;
      text.doc!.transact(() => {
        let index = 0;
        for (const change of diffChars(text.toString(), source)) {
          if (change.removed) text.delete(index, change.value.length);
          else {
            if (change.added) text.insert(index, change.value);
            index += change.value.length;
          }
        }
      });
      return false;
    },
    setComposing(value: boolean) {
      if (!value) return finish();
      if (draft || preview) return;
      draft = session.createDraft();
      draftHistory = historyId;
    },
    applyLocalUpdate(update: Uint8Array) {
      if (draft || preview) throw new Error("Finish your current text first");
      binding.applyLocalUpdate(update);
    },
    createDraft() {
      beforeReceive?.();
      if (draft || preview) throw new Error("Finish your current text first");
      const original = session.createDraft();
      const originalHistory = historyId;
      const retain = () => {
        if (draft && draft !== original) throw new Error("Finish your current text first");
        draft = original;
        preview ??= clone(original.text.doc!);
      };
      return {
        text: original.text,
        commit() {
          if (draft && draft !== original) throw new Error("Finish your current text first");
          draft = original;
          draftHistory = originalHistory;
          return Promise.resolve(finish());
        },
        retain() {
          retain();
          failure = session.getSnapshot().error ?? new Error("Your draft is kept here");
          changed();
        },
        cancel: () => (draft === original ? cancelComposition() : original.cancel()),
      };
    },
    isComposing: () => Boolean(draft && !preview),
    isFinishing: () => Boolean(preview),
    failure: () => failure,
    retry: finish,
    cancelComposition,
    subscribeRecovery(listener: () => void) {
      recoveryListeners.add(listener);
      return () => {
        recoveryListeners.delete(listener);
      };
    },
    subscribe(listener: (source: string, origin: Origin) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    undo() {
      if (!draft && !preview) binding.undo();
    },
    redo() {
      if (!draft && !preview) binding.redo();
    },
    destroy() {
      stopReceive();
      stopClose();
      stopSession();
      stopBinding();
      binding.destroy();
      draft?.cancel();
      preview?.destroy();
      listeners.clear();
      recoveryListeners.clear();
    },
  };
};
