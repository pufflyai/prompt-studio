import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import type { SessionAttachment } from "pstdio-api-contracts";

const readAttachments = (storage: WorkbenchStorageLike, key: string) => {
  const value = storage.getItem(key);
  if (!value) return [] as SessionAttachment[];
  try {
    const attachments = JSON.parse(value) as SessionAttachment[];
    return Array.isArray(attachments) ? attachments : [];
  } catch {
    return [];
  }
};

export const createSessionDraftAttachmentsPersistence = (storage: WorkbenchStorageLike, namespace: string) => {
  const createDraft = (key: string) => {
    let snapshot = { attachments: readAttachments(storage, key), uploading: false };
    let uploads = 0;
    const listeners = new Set<() => void>();
    const notify = () => {
      for (const listener of listeners) listener();
    };
    return {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      changeAttachments: (update: (current: SessionAttachment[]) => SessionAttachment[]) => {
        const attachments = update(snapshot.attachments);
        storage.setItem(key, JSON.stringify(attachments));
        snapshot = { ...snapshot, attachments };
        notify();
      },
      changeUploading: (change: number) => {
        uploads += change;
        snapshot = { ...snapshot, uploading: uploads > 0 };
        notify();
      },
    };
  };
  const drafts = new Map<string, ReturnType<typeof createDraft>>();
  return {
    getAttachmentDraft: (projectId: string, draftKey: string) => {
      const key = `${namespace}:session-attachments:${projectId}:${draftKey}`;
      let draft = drafts.get(key);
      if (!draft) {
        draft = createDraft(key);
        drafts.set(key, draft);
      }
      return draft;
    },
  };
};
