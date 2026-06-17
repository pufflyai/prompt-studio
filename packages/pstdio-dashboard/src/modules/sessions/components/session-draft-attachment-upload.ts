import type { SessionAttachment } from "pstdio-api-contracts";

export const uploadDraftAttachmentFiles = async (input: {
  files: File[];
  onUploaded: (attachment: SessionAttachment) => void;
  uploadFile: (file: File) => Promise<SessionAttachment>;
}) => {
  for (const file of input.files) {
    const attachment = await input.uploadFile(file);
    input.onUploaded(attachment);
  }
};
