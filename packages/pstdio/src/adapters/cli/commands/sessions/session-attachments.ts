import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import type { SessionAttachment, SessionAttachmentRef } from "@pstdio/sdk/api";
import { apiClient } from "@/features/api-client";

type UploadAttachment = (
  projectId: string,
  input: { name: string; data: Uint8Array; mimeType: string },
) => Promise<SessionAttachment>;

type DeleteAttachment = (projectId: string, fileId: string) => Promise<void>;

export type UploadCliSessionAttachmentsInput = {
  projectId: string;
  paths?: string[];
  cwd: string;
  uploadAttachment?: UploadAttachment;
  deleteAttachment?: DeleteAttachment;
};

const MIME_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp",
};

export const inferMimeType = (filePath: string) =>
  MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";

const defaultUploadAttachment: UploadAttachment = (projectId, input) =>
  apiClient().sessions.uploadAttachment(projectId, input);

const defaultDeleteAttachment: DeleteAttachment = (projectId, fileId) =>
  apiClient().sessions.deleteAttachment(projectId, fileId);

export const deleteCliSessionAttachments = async (input: {
  projectId: string;
  attachments?: SessionAttachmentRef[];
  deleteAttachment?: DeleteAttachment;
}) => {
  const deleteAttachment = input.deleteAttachment ?? defaultDeleteAttachment;

  for (const attachment of input.attachments ?? []) {
    await deleteAttachment(input.projectId, attachment.file_id).catch(() => undefined);
  }
};

export const uploadCliSessionAttachments = async (
  input: UploadCliSessionAttachmentsInput,
): Promise<SessionAttachmentRef[] | undefined> => {
  if (!input.paths || input.paths.length === 0) return undefined;

  const uploadAttachment = input.uploadAttachment ?? defaultUploadAttachment;
  const refs: SessionAttachmentRef[] = [];

  try {
    for (const attachmentPath of input.paths) {
      const absolutePath = resolve(input.cwd, attachmentPath);
      const uploaded = await uploadAttachment(input.projectId, {
        name: basename(attachmentPath),
        data: readFileSync(absolutePath),
        mimeType: inferMimeType(absolutePath),
      });
      refs.push({ file_id: uploaded.file_id });
    }
  } catch (error) {
    await deleteCliSessionAttachments({
      projectId: input.projectId,
      attachments: refs,
      deleteAttachment: input.deleteAttachment,
    });
    throw error;
  }

  return refs;
};
