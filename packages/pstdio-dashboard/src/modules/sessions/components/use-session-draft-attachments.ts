import type { SessionAttachment } from "pstdio-api-contracts";
import { useRef, useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/api";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { uploadDraftAttachmentFiles } from "./session-draft-attachment-upload";
import { createClipboardAttachmentFile } from "./session-draft-clipboard-attachment";

const uploadSessionAttachment = async (projectId: string, file: File) =>
  apiRequest<SessionAttachment>(`/v1/projects/${encodeURIComponent(projectId)}/session-attachments`, {
    method: "POST",
    body: await file.arrayBuffer(),
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
    },
  });

export const deleteSessionAttachment = (projectId: string, fileId: string) =>
  apiRequest<void>(`/v1/projects/${encodeURIComponent(projectId)}/session-attachments/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });

const emptySnapshot = { attachments: [] as SessionAttachment[], uploading: false };
const getEmptySnapshot = () => emptySnapshot;
const subscribeEmpty = () => () => undefined;

// The keyed panel displays one conversation. Leaving it keeps the draft and its uploaded files.
export const useSessionDraftAttachments = (
  projectId: string | undefined,
  draftKey: string,
  drafts: DashboardSessionDraftPersistence | undefined,
  savedFileIds: string[] = [],
) => {
  const draft = projectId ? drafts?.getAttachmentDraft(projectId, draftKey) : undefined;
  const { attachments, uploading } = useSyncExternalStore(
    draft?.subscribe ?? subscribeEmpty,
    draft?.getSnapshot ?? getEmptySnapshot,
  );
  const clipboardAttachmentCountRef = useRef(0);

  const uploadFiles = async (files: File[]) => {
    if (!projectId || !draft || files.length === 0) return;
    draft.changeUploading(1);
    try {
      await uploadDraftAttachmentFiles({
        files,
        onUploaded: (attachment) => draft.changeAttachments((current) => [...current, attachment]),
        uploadFile: (file) => uploadSessionAttachment(projectId, file),
      });
    } finally {
      draft.changeUploading(-1);
    }
  };

  const uploadText = (text: string) => {
    clipboardAttachmentCountRef.current += 1;
    return uploadFiles([createClipboardAttachmentFile(text, clipboardAttachmentCountRef.current)]);
  };

  const removeAttachment = (fileId: string) => {
    if (!projectId) return;
    if (savedFileIds.includes(fileId)) {
      draft?.changeAttachments((current) => current.filter((attachment) => attachment.file_id !== fileId));
      return;
    }
    void deleteSessionAttachment(projectId, fileId)
      .then(() => draft?.changeAttachments((current) => current.filter((attachment) => attachment.file_id !== fileId)))
      .catch(() => undefined);
  };

  const restoreAttachments = (restored: SessionAttachment[]) => {
    draft?.changeAttachments((current) => [
      ...restored,
      ...current.filter((attachment) => !restored.some((item) => item.file_id === attachment.file_id)),
    ]);
  };

  return {
    attachments,
    clearSubmittedAttachments: () => draft?.changeAttachments(() => []),
    removeAttachment,
    restoreAttachments,
    uploadFiles,
    uploadText,
    uploading,
  };
};
