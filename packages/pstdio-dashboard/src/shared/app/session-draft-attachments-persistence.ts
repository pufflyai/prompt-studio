import { createWorkbenchStore } from "@pstdio/workbench";
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
  const drafts = new Map<string, ReturnType<typeof createDraft>>();
  const trim = (protectedKey?: string) => {
    const inactive = [...drafts].filter(([key, draft]) => key !== protectedKey && !draft.retained());
    for (const [key] of inactive.slice(0, Math.max(0, drafts.size - 128))) drafts.delete(key);
  };
  const createDraft = (key: string) => {
    const projection = createWorkbenchStore({
      name: "dashboard.attachment-draft",
      initialState: {
        attachments: readAttachments(storage, key),
        uploading: false,
      },
    });
    let uploads = 0;
    let observers = 0;
    return {
      getSnapshot: projection.getState,
      retained: () => uploads > 0 || observers > 0,
      subscribe: (listener: () => void) => {
        observers++;
        const stop = projection.subscribe(listener);
        let released = false;
        return () => {
          if (released) return;
          released = true;
          stop();
          observers--;
          trim();
        };
      },
      changeAttachments: (update: (current: SessionAttachment[]) => SessionAttachment[]) => {
        const attachments = update(projection.getState().attachments);
        storage.setItem(key, JSON.stringify(attachments));
        projection.setState({ attachments }, false, "changeAttachments");
      },
      changeUploading: (change: number) => {
        uploads += change;
        if (projection.getState().uploading !== uploads > 0)
          projection.setState({ uploading: uploads > 0 }, false, "changeUploading");
        trim(key);
      },
    };
  };
  return {
    getAttachmentDraft: (projectId: string, draftKey: string) => {
      const key = `${namespace}:session-attachments:${projectId}:${draftKey}`;
      let draft = drafts.get(key);
      if (!draft) {
        draft = createDraft(key);
      }
      drafts.delete(key);
      drafts.set(key, draft);
      trim(key);
      return draft;
    },
  };
};
