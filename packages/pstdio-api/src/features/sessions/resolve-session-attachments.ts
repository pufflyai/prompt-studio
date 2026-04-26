import { readFileSync } from "node:fs";
import type { SessionPromptAttachment } from "pstdio-api-contracts";
import type { createFileService } from "../../services/file-service";

type ResolveSessionAttachmentsDeps = {
  fileService: Pick<ReturnType<typeof createFileService>, "get">;
};

export const resolveSessionAttachments = async (
  attachments: SessionPromptAttachment[] | undefined,
  projectId: string,
  deps: ResolveSessionAttachmentsDeps,
) => {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const resolved = [] as Array<SessionPromptAttachment & { data_base64: string }>;

  for (const attachment of attachments) {
    const file = await deps.fileService.get(attachment.id);
    if (!file) {
      throw new Error(`Attachment not found: ${attachment.id}`);
    }

    if (file.project_id !== projectId) {
      throw new Error(`Attachment does not belong to project: ${attachment.id}`);
    }

    if (file.file_kind !== "session_attachment") {
      throw new Error(`Attachment is not a session upload: ${attachment.id}`);
    }

    if (file.mime_type == null) {
      throw new Error(`Attachment MIME type is missing: ${attachment.id}`);
    }

    if (
      attachment.file_name !== file.file_name ||
      attachment.mime_type !== file.mime_type ||
      attachment.size_bytes !== file.size_bytes
    ) {
      throw new Error(`Attachment metadata mismatch: ${attachment.id}`);
    }

    const data = readFileSync(file.storage_path);
    resolved.push({
      id: file.id,
      file_name: file.file_name,
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
      data_base64: data.toString("base64"),
    });
  }

  return resolved;
};
