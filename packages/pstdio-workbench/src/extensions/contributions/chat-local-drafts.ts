import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import { chatDraftContentKey, hasChatDraftContent, hydrateChatDraft } from "./chat-draft-recovery";
import type { LegacyChatDraftTransfer } from "./chat-legacy-draft";
import type { ChatSession } from "./chat-session";

const clientKey = "pstdio-workbench:chat-draft-client";

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
  const parse = (raw: string | null) => (raw === null ? undefined : chatDraftSchema.parse(JSON.parse(raw)));
  const read = (key: string) => parse(storage().getItem(key));
  const save = (draft: ChatDraft) => {
    const raw = JSON.stringify(draft);
    if (storage().getItem(localKey) !== raw) storage().setItem(localKey, raw);
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
    save,
    restore(session: ChatSession) {
      try {
        const local = read(localKey);
        const pendingRaw = storage().getItem(pendingKey);
        const pending = parse(pendingRaw);
        const legacy = readLegacy();
        const sources = [local, pending, legacy?.draft].filter((draft) => draft !== undefined);
        const primary = sources[0];
        if (!primary) return;
        const draft = sources.slice(1).reduce(hydrateChatDraft, primary);
        save(draft);
        if (pending && storage().getItem(pendingKey) === pendingRaw) storage().removeItem?.(pendingKey);
        legacy?.acknowledge();
        session.changeDraft(draft);
      } catch (error) {
        session.reportError(error);
      }
    },
    contains(draft: ChatDraft) {
      const saved = read(localKey);
      if (!saved) return false;
      const contents = new Set([saved, ...(saved.recovered ?? [])].map(chatDraftContentKey));
      return [draft, ...(draft.recovered ?? [])]
        .filter(hasChatDraftContent)
        .every((entry) => contents.has(chatDraftContentKey(entry)));
    },
  };
};
