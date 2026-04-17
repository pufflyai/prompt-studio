import type { SessionChatDraftAttachment } from "./session-chat-attachments";

const revokePreviewUrl = (previewUrl: string, revokeObjectURL: (url: string) => void) => {
  revokeObjectURL(previewUrl);
};

export const appendDraftAttachments = (current: SessionChatDraftAttachment[], next: SessionChatDraftAttachment[]) => [
  ...current,
  ...next,
];

export const removeDraftAttachment = (
  current: SessionChatDraftAttachment[],
  attachmentId: string,
  revokeObjectURL: (url: string) => void,
) => {
  const target = current.find((item) => item.upload.id === attachmentId);
  if (target) {
    revokePreviewUrl(target.previewUrl, revokeObjectURL);
  }

  return current.filter((item) => item.upload.id !== attachmentId);
};

export const clearDraftAttachments = (
  current: SessionChatDraftAttachment[],
  revokeObjectURL: (url: string) => void,
) => {
  for (const attachment of current) {
    revokePreviewUrl(attachment.previewUrl, revokeObjectURL);
  }

  return [];
};
