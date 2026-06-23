import type { SessionAttachment } from "pstdio-api-contracts";

export type DeleteDraftAttachment = (projectId: string, fileId: string) => Promise<void>;

const withoutAttachment = (attachments: SessionAttachment[], fileId: string) =>
  attachments.filter((attachment) => attachment.file_id !== fileId);

export const cleanupDraftAttachments = (
  projectId: string | undefined,
  attachments: SessionAttachment[],
  deleteAttachment: DeleteDraftAttachment,
) => {
  if (!projectId) return;

  for (const attachment of attachments) {
    void deleteAttachment(projectId, attachment.file_id).catch(() => undefined);
  }
};

export const removeDeletedDraftAttachment = async (input: {
  attachments: SessionAttachment[];
  deleteAttachment: DeleteDraftAttachment;
  fileId: string;
  projectId: string | undefined;
}) => {
  if (input.projectId) {
    await input.deleteAttachment(input.projectId, input.fileId);
  }

  return withoutAttachment(input.attachments, input.fileId);
};

export const resetDraftAttachmentsForProjectChange = (input: {
  attachments: SessionAttachment[];
  deleteAttachment: DeleteDraftAttachment;
  nextProjectId: string | undefined;
  previousProjectId: string | undefined;
}) => {
  if (input.previousProjectId === input.nextProjectId) return input.attachments;

  cleanupDraftAttachments(input.previousProjectId, input.attachments, input.deleteAttachment);
  return [];
};

export const clearSubmittedDraftAttachments = (input: {
  attachmentsRef: { current: SessionAttachment[] };
  setAttachments: (attachments: SessionAttachment[]) => void;
}) => {
  input.attachmentsRef.current = [];
  input.setAttachments([]);
};
