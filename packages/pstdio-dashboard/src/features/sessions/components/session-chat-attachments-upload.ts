import type { SessionAttachmentRef } from "../session-attachment-ref";

type UploadCandidate = {
  file: File;
  base64: string;
};

type UploadResult = {
  upload: SessionAttachmentRef;
  previewUrl: string;
};

type UploadFailure = {
  fileName: string;
  errorMessage: string;
};

type UploadDeps = {
  uploadAttachment: (input: {
    projectId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }) => Promise<SessionAttachmentRef>;
  createPreviewUrl: (file: File) => string;
};

export const uploadSessionChatAttachments = async (
  projectId: string,
  candidates: UploadCandidate[],
  deps: UploadDeps,
) => {
  const uploaded: UploadResult[] = [];
  const failed: UploadFailure[] = [];

  for (const candidate of candidates) {
    try {
      const upload = await deps.uploadAttachment({
        projectId,
        fileName: candidate.file.name,
        mimeType: candidate.file.type,
        contentBase64: candidate.base64,
      });

      uploaded.push({
        upload,
        previewUrl: deps.createPreviewUrl(candidate.file),
      });
    } catch (error) {
      failed.push({
        fileName: candidate.file.name,
        errorMessage: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }

  return { uploaded, failed };
};
