import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import { resolveStorage, type WorkbenchStorageLike } from "../../storage/local-storage-persistence-helpers";
import { hydrateChatDraft } from "./chat-draft-recovery";
import type { ChatSession } from "./chat-session";

interface ChatDraftPersistenceInput {
  key: string;
  load?(): Promise<unknown>;
  save(draft: ChatDraft): Promise<unknown>;
  captureSave?(): (draft: ChatDraft) => Promise<unknown>;
  storage?: WorkbenchStorageLike;
}

interface DraftWriter {
  owner: symbol;
  saving: Promise<void>;
}
const writers = new WeakMap<WorkbenchStorageLike, Map<string, DraftWriter>>();

/** The provider owns saved drafts; this browser journal owns only unacknowledged edits. */
export const createChatDraftPersistence = (input: ChatDraftPersistenceInput) => {
  const storage = resolveStorage(input.storage);
  const key = `pstdio-workbench:chat-draft-pending:${input.key}`;
  let scoped = writers.get(storage);
  if (!scoped) {
    scoped = new Map();
    writers.set(storage, scoped);
  }
  const owner = Symbol();
  const writer = scoped.get(key) ?? { owner, saving: Promise.resolve() };
  writer.owner = owner;
  scoped.set(key, writer);
  let closed = false;
  const current = () => !closed && writer.owner === owner;
  let recoveryRead = false;
  let recovery: ChatDraft | undefined;
  const pending = () => {
    if (!recoveryRead) {
      const raw = storage.getItem(key);
      recovery = raw === null ? undefined : chatDraftSchema.parse(JSON.parse(raw));
      recoveryRead = true;
    }
    return recovery;
  };
  const saveDraft = async (draft: ChatDraft, execute = input.captureSave?.() ?? input.save) => {
    const staged = JSON.stringify(draft);
    const save = writer.saving.then(async () => {
      if (!current()) throw new Error("The native draft owner was replaced.");
      await execute(draft);
      // A completed older save cannot acknowledge typing that followed it.
      if (storage.getItem(key) === staged) storage.removeItem?.(key);
    });
    // Replacement owners share ordering, including writes already in flight.
    writer.saving = save.catch(() => undefined);
    await save;
  };
  return {
    /** Release after the owner's final save settles, retaining no visited-resource registry. */
    dispose() {
      if (current()) {
        // An idle replacement can still inherit a predecessor's in-flight write.
        void writer.saving.then(() => {
          if (writer.owner !== owner || scoped.get(key) !== writer) return;
          scoped.delete(key);
          if (!scoped.size) writers.delete(storage);
        });
      }
      closed = true;
    },
    stageDraft(draft: ChatDraft) {
      if (!current()) return;
      const raw = JSON.stringify(draft);
      if (storage.getItem(key) !== raw) storage.setItem(key, raw);
    },
    saveDraft,
    captureSaveDraft: () => {
      const execute = input.captureSave?.() ?? input.save;
      return (draft: ChatDraft) => saveDraft(draft, execute);
    },
    loadDraft: input.load
      ? async () => {
          // Current-owner edits already live in ChatSession. Hydrate only the incoming
          // journal, not placeholder controls staged while this provider read waits.
          const staged = pending();
          const saved = chatDraftSchema.parse(await input.load!());
          return staged ? hydrateChatDraft(staged, saved) : saved;
        }
      : undefined,
    restore(session: ChatSession) {
      try {
        const staged = pending();
        if (staged) session.changeDraft(staged);
      } catch (error) {
        session.reportError(error);
      }
    },
  };
};
