import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import type { WorkbenchStorageLike } from "../../storage/local-storage-persistence-helpers";

// Desktop rewrites one state file per write, so typing is saved after a short pause.
const WRITE_DELAY_MS = 300;

const draftStorageKey = (key: string) => `pstdio-workbench:chat-draft:${key}`;

const resolveStorage = (storage: WorkbenchStorageLike | undefined) => {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

const isEmpty = (draft: ChatDraft) => !draft.text && !draft.attachments.length && !Object.keys(draft.values).length;

const readDraft = (storage: WorkbenchStorageLike | undefined, key: string) => {
  const raw = storage?.getItem(draftStorageKey(key));
  if (!raw) return undefined;
  try {
    // Older releases stored extra fields with the draft. Keep its text and drop the rest.
    const { text, attachments, values } = JSON.parse(raw) as Partial<ChatDraft>;
    return chatDraftSchema.parse({ text, attachments: attachments ?? [], values: values ?? {} });
  } catch {
    return undefined;
  }
};

// The newest view of a conversation owns its draft; a replaced one stops writing.
const owners = new WeakMap<WorkbenchStorageLike, Map<string, symbol>>();

/** One unsent draft per conversation, kept on this device. */
export const createLocalChatDraft = (key: string, input?: WorkbenchStorageLike) => {
  const storage = resolveStorage(input);
  const storageKey = draftStorageKey(key);
  const owner = Symbol(key);
  const scoped = storage && (owners.get(storage) ?? new Map<string, symbol>());
  if (storage && scoped) {
    owners.set(storage, scoped);
    scoped.set(storageKey, owner);
  }
  let pending: ChatDraft | undefined;
  let written: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const draft = pending;
    const settled = written;
    pending = undefined;
    written = undefined;
    try {
      if (draft && storage && scoped?.get(storageKey) === owner) {
        if (isEmpty(draft)) storage.removeItem?.(storageKey);
        else storage.setItem(storageKey, JSON.stringify(draft));
      }
      settled?.resolve();
    } catch (error) {
      settled?.reject(error);
    }
  };
  globalThis.addEventListener?.("pagehide", flush);
  return {
    read: () => pending ?? readDraft(storage, key),
    /** Resolves once the draft is written; quick successive saves share one write. */
    save(draft: ChatDraft) {
      pending = draft;
      written ??= Promise.withResolvers<void>();
      timer ??= setTimeout(flush, WRITE_DELAY_MS);
      return written.promise;
    },
    flush,
    dispose() {
      globalThis.removeEventListener?.("pagehide", flush);
      flush();
      if (scoped?.get(storageKey) === owner) scoped.delete(storageKey);
    },
  };
};

/** Only a conversation without a draft can be seeded; typed work always wins. */
export const seedLocalChatDraft = (key: string, draft: ChatDraft, input?: WorkbenchStorageLike) => {
  const storage = resolveStorage(input);
  if (!storage) throw new Error("Draft storage is unavailable.");
  const storageKey = draftStorageKey(key);
  if (storage.getItem(storageKey) !== null) throw new Error("The conversation already has a draft.");
  const raw = JSON.stringify(chatDraftSchema.parse(draft));
  storage.setItem(storageKey, raw);
  return () => {
    if (storage.getItem(storageKey) === raw) storage.removeItem?.(storageKey);
  };
};
