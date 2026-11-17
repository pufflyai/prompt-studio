import type { ChatDraft } from "@pstdio/sdk/extensions";
import { chatDraftSchema } from "pstdio-api-contracts";
import { resolveStorage } from "../../storage/local-storage-persistence-helpers";
import { chatDraftContentKey } from "./chat-draft-recovery";
import type { LegacyChatDraftTransfer } from "./chat-legacy-draft";
import type { ChatSession } from "./chat-session";

const clientKey = "pstdio-workbench:chat-draft-client";
let documentClient: string | undefined;

export const createLocalChatDrafts = (key: string, readLegacy: () => LegacyChatDraftTransfer | undefined) => {
  const storage = resolveStorage();
  const localKey = `pstdio-workbench:chat-draft:${key}`;
  const pendingKey = `pstdio-workbench:chat-draft-pending:${key}`;
  const read = (key: string) => {
    const raw = storage.getItem(key);
    return raw === null ? undefined : chatDraftSchema.parse(JSON.parse(raw));
  };
  const save = (draft: ChatDraft) => {
    const raw = JSON.stringify(draft);
    if (storage.getItem(localKey) !== raw) storage.setItem(localKey, raw);
  };
  const clientId = () => {
    try {
      const existing = storage.getItem(clientKey);
      if (existing) return existing;
      const created = crypto.randomUUID();
      storage.setItem(clientKey, created);
      return created;
    } catch {
      // The composer can still send when browser persistence is unavailable.
    }
    documentClient ??= crypto.randomUUID();
    return documentClient;
  };
  return {
    clientId: clientId(),
    save,
    restore(session: ChatSession) {
      try {
        const local = read(localKey);
        if (local) {
          session.changeDraft(local);
          return;
        }
        const pending = read(pendingKey);
        const legacy = pending ? undefined : readLegacy();
        const draft = pending ?? legacy?.draft;
        if (!draft) return;
        save(draft);
        if (pending) storage.removeItem?.(pendingKey);
        legacy?.acknowledge();
        session.changeDraft(draft);
      } catch (error) {
        session.reportError(error);
      }
    },
    contains(draft: ChatDraft) {
      const saved = read(localKey);
      if (!saved) return false;
      const key = chatDraftContentKey(draft);
      return [saved, ...(saved.recovered ?? [])].some((entry) => chatDraftContentKey(entry) === key);
    },
  };
};
