import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import { chatDraftContentKey, hasChatDraftContent, hydrateChatDraft } from "./chat-draft-recovery";
import type { LegacyChatDraftTransfer } from "./chat-legacy-draft";
import type { ChatSession } from "./chat-session";

const clientKey = "pstdio-workbench:chat-draft-client";
const browserOwners = new WeakMap<Storage, Map<string, symbol>>();

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
  const owners = (browserStorage && browserOwners.get(browserStorage)) ?? new Map<string, symbol>();
  const owner = Symbol();
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
    restore(session: ChatSession) {
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
