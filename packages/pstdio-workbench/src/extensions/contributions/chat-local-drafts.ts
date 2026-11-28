import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import type { WorkbenchStorageLike } from "../../storage/local-storage-persistence-helpers";

const draftStorageKey = (key: string) => `pstdio-workbench:chat-draft:${key}`;

const resolveStorage = (storage: WorkbenchStorageLike | undefined) => {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

// Control values alone are not a draft, so a sent or emptied draft leaves nothing behind.
const isEmpty = (draft: ChatDraft) => !draft.text && !draft.attachments.length;

const readDraft = (storage: WorkbenchStorageLike | undefined, key: string) => {
  const raw = storage?.getItem(draftStorageKey(key));
  if (!raw) return undefined;
  try {
    // Older releases stored a restore list with the draft; parsing drops it.
    return chatDraftSchema.parse(JSON.parse(raw));
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
  return {
    read: () => readDraft(storage, key),
    // Written on every change, as desktop layout is, so quitting right after typing keeps it.
    // The desktop main process batches the disk writes.
    save(draft: ChatDraft) {
      if (!storage || scoped?.get(storageKey) !== owner) return;
      if (isEmpty(draft)) storage.removeItem?.(storageKey);
      else storage.setItem(storageKey, JSON.stringify(draft));
    },
    dispose() {
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
