import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import { chatDraftContentKey, hasChatDraftContent, hydrateChatDraft } from "./chat-draft-recovery";
import type { LegacyChatDraftTransfer } from "./chat-legacy-draft";
import type { ChatSession } from "./chat-session";

const clientKey = "pstdio-workbench:chat-draft-client";
interface BrowserDraftOwner {
  discard?(contentKey: string): void;
}
const browserOwners = new WeakMap<Storage, Map<string, BrowserDraftOwner>>();

const withoutRecovery = (draft: ChatDraft, contentKey: string) => {
  const recovered = draft.recovered?.filter((item) => chatDraftContentKey(item) !== contentKey);
  return recovered?.length === draft.recovered?.length ? draft : { ...draft, recovered };
};

export const createLocalChatDrafts = (key: string, readLegacy: () => LegacyChatDraftTransfer | undefined) => {
  // Recovery receipts require durable browser storage, never the workbench's memory fallback.
  const browserStorage = (() => {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  })();
  const storage = () => {
    if (!browserStorage) throw new Error("Browser draft storage is unavailable.");
    return browserStorage;
  };
  const localKey = `pstdio-workbench:chat-draft:${key}`;
  const pendingKey = `pstdio-workbench:chat-draft-pending:${key}`;
  const owners = (browserStorage && browserOwners.get(browserStorage)) ?? new Map<string, BrowserDraftOwner>();
  const owner: BrowserDraftOwner = {};
  if (browserStorage) browserOwners.set(browserStorage, owners);
  owners.set(localKey, owner);
  const current = () => owners.get(localKey) === owner;
  let restoreFailure: { cause: unknown } | undefined;
  const parse = (raw: string | null) => (raw === null ? undefined : chatDraftSchema.parse(JSON.parse(raw)));
  const read = (key: string) => parse(storage().getItem(key));
  const write = (draft: ChatDraft) => {
    const store = storage();
    if (!current()) throw new Error("The native draft owner was replaced.");
    const raw = JSON.stringify(draft);
    if (store.getItem(localKey) !== raw) store.setItem(localKey, raw);
  };
  const clientId = () => {
    try {
      const existing = storage().getItem(clientKey);
      if (existing) return existing;
      const created = crypto.randomUUID();
      storage().setItem(clientKey, created);
      return created;
    } catch {
      // The composer can still send. An unowned accepted input remains recoverable
      // after reload; claiming a volatile browser identity would strand it.
    }
    return undefined;
  };
  return {
    clientId: clientId(),
    dispose() {
      if (!current()) return;
      owners.delete(localKey);
      if (browserStorage && !owners.size) browserOwners.delete(browserStorage);
    },
    save(draft: ChatDraft) {
      // An incomplete migration still needs its original sources on the next open.
      if (restoreFailure) throw restoreFailure.cause;
      write(draft);
    },
    discardRecovery(contentKey: string) {
      const active = browserStorage && browserOwners.get(browserStorage)?.get(localKey);
      if (active?.discard) {
        active.discard(contentKey);
        return;
      }
      const store = storage();
      const raw = store.getItem(localKey);
      const saved = parse(raw);
      if (!saved) return;
      const next = withoutRecovery(saved, contentKey);
      if (saved !== next && store.getItem(localKey) === raw) store.setItem(localKey, JSON.stringify(next));
    },
    restore(session: ChatSession) {
      owner.discard = (contentKey) => {
        if (restoreFailure) throw restoreFailure.cause;
        const currentDraft = session.getSnapshot().draft;
        const saved = read(localKey);
        const nextSaved = saved && withoutRecovery(saved, contentKey);
        if (nextSaved && saved !== nextSaved) write(nextSaved);
        const nextDraft = withoutRecovery(currentDraft, contentKey);
        if (nextDraft !== currentDraft) session.changeDraft({ recovered: nextDraft.recovered });
      };
      try {
        const local = read(localKey);
        const pendingRaw = storage().getItem(pendingKey);
        const pending = parse(pendingRaw);
        const legacy = readLegacy();
        const sources = [local, pending, legacy?.draft].filter((draft) => draft !== undefined);
        const primary = sources[0];
        restoreFailure = undefined;
        if (!primary) return;
        const draft = sources.slice(1).reduce(hydrateChatDraft, primary);
        session.storedDraft.restore(draft);
        write(draft);
        if (pending && storage().getItem(pendingKey) === pendingRaw) storage().removeItem?.(pendingKey);
        legacy?.acknowledge();
      } catch (error) {
        restoreFailure = { cause: error };
        session.storedDraft.reportError(error);
      }
    },
    contains(draft: ChatDraft) {
      if (!current()) return false;
      const saved = read(localKey);
      if (!saved) return false;
      const contents = new Set([saved, ...(saved.recovered ?? [])].map(chatDraftContentKey));
      return [draft, ...(draft.recovered ?? [])]
        .filter(hasChatDraftContent)
        .every((entry) => contents.has(chatDraftContentKey(entry)));
    },
  };
};

/** Only fresh resource identities may be seeded; live or persisted edits always win. */
export const seedLocalChatDraft = (key: string, draft: ChatDraft) => {
  const value = chatDraftSchema.parse(draft);
  const storage = globalThis.localStorage;
  if (!storage) throw new Error("Browser draft storage is unavailable.");
  const localKey = `pstdio-workbench:chat-draft:${key}`;
  if (
    browserOwners.get(storage)?.has(localKey) ||
    storage.getItem(localKey) !== null ||
    storage.getItem(`pstdio-workbench:chat-draft-pending:${key}`) !== null
  )
    throw new Error("The conversation already has a draft.");
  const raw = JSON.stringify(value);
  storage.setItem(localKey, raw);
  return () => {
    if (!browserOwners.get(storage)?.has(localKey) && storage.getItem(localKey) === raw) storage.removeItem(localKey);
  };
};
