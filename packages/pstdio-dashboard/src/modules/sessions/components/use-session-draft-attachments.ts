import type { SessionAttachment } from "pstdio-api-contracts";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  cleanupDraftAttachments,
  clearSubmittedDraftAttachments,
  removeDeletedDraftAttachment,
  resetDraftAttachmentsForProjectChange,
} from "./session-draft-attachment-state";
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

const deleteSessionAttachment = (projectId: string, fileId: string) =>
  apiRequest<void>(`/v1/projects/${encodeURIComponent(projectId)}/session-attachments/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });

export const useSessionDraftAttachments = (projectId: string | undefined) => {
  const [attachments, setAttachments] = useState<SessionAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const attachmentsRef = useRef(attachments);
  const projectIdRef = useRef(projectId);
  const clipboardAttachmentCountRef = useRef(0);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    const previousProjectId = projectIdRef.current;
    if (previousProjectId === projectId) return;

    projectIdRef.current = projectId;
    setAttachments((current) =>
      resetDraftAttachmentsForProjectChange({
        attachments: current,
        deleteAttachment: deleteSessionAttachment,
        nextProjectId: projectId,
        previousProjectId,
      }),
    );
  }, [projectId]);

  useEffect(() => {
    return () => {
      cleanupDraftAttachments(projectIdRef.current, attachmentsRef.current, deleteSessionAttachment);
    };
  }, []);

  const uploadFiles = async (files: File[]) => {
    if (!projectId || files.length === 0) return;

    setUploading(true);
    try {
      await uploadDraftAttachmentFiles({
        files,
        onUploaded: (attachment) => setAttachments((current) => [...current, attachment]),
        uploadFile: (file) => uploadSessionAttachment(projectId, file),
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadText = (text: string) => {
    clipboardAttachmentCountRef.current += 1;
    return uploadFiles([createClipboardAttachmentFile(text, clipboardAttachmentCountRef.current)]);
  };

  const removeAttachment = (fileId: string) => {
    void removeDeletedDraftAttachment({
      attachments: attachmentsRef.current,
      deleteAttachment: deleteSessionAttachment,
      fileId,
      projectId,
    })
      .then(() => {
        setAttachments((current) => current.filter((attachment) => attachment.file_id !== fileId));
      })
      .catch(() => undefined);
  };

  const clearSubmittedAttachments = () => {
    clearSubmittedDraftAttachments({ attachmentsRef, setAttachments });
  };

  return {
    attachments,
    clearSubmittedAttachments,
    removeAttachment,
    uploadFiles,
    uploadText,
    uploading,
  };
};
