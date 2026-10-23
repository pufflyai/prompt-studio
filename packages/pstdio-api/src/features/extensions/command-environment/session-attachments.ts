import { readFile } from "node:fs/promises";
import type { ExtensionSessionControlsApi } from "pstdio-api-contracts/extension-kernel";
import { uploadSessionAttachment } from "../../sessions/session-attachment-upload";
import { getProjectSessionAttachment, isSessionAttachmentSubmitted } from "../../sessions/session-attachments";
import type { ExtensionsRouteDeps } from "../deps";
import { createSessionAccess, type SessionApiScope } from "./session-access";

type Attachments = Pick<ExtensionSessionControlsApi, "uploadAttachment" | "readAttachment" | "deleteAttachment">;

export const createSessionAttachments = (deps: ExtensionsRouteDeps, input: SessionApiScope) => {
  const { read } = createSessionAccess(deps, input);
  const requireAttachment = async (fileId: string) => {
    const file = await read(() => getProjectSessionAttachment(deps, input.projectId, fileId));
    if (!file) throw new Error(`Session attachment not found: ${fileId}`);
    return file;
  };
  return {
    uploadAttachment: async (attachment) => {
      const project = await read(() => deps.projectService.get(input.projectId));
      if (!project) throw new Error(`Project not found: ${input.projectId}`);
      return uploadSessionAttachment(deps, input.projectId, attachment);
    },
    readAttachment: (fileId) =>
      read(async () => {
        const file = await requireAttachment(fileId);
        return read(() => readFile(file.storage_path));
      }),
    deleteAttachment: async (fileId) => {
      await requireAttachment(fileId);
      if (await read(() => isSessionAttachmentSubmitted(deps, input.projectId, fileId)))
        throw new Error("Session attachment is already submitted.");
      await deps.fileService.remove(fileId);
    },
  } satisfies Attachments;
};
