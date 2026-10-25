import {
  supportedSessionAttachmentExtensions,
  supportedSessionAttachmentMimeTypes,
} from "pstdio-api-contracts/session-attachment-types";
import type { SessionsRouteDeps } from "./deps";
import { SESSION_ATTACHMENT_FILE_KIND, toSessionAttachment } from "./session-attachments";

export class SessionAttachmentUploadError extends Error {
  constructor(
    message: string,
    readonly status: 413 | 415,
  ) {
    super(message);
  }
}

export const uploadSessionAttachment = async (
  deps: SessionsRouteDeps,
  projectId: string,
  input: { name: string; data: Uint8Array | ArrayBuffer; mimeType?: string | null },
) => {
  const data = Buffer.from(input.data instanceof ArrayBuffer ? new Uint8Array(input.data) : input.data);
  if (data.byteLength > 25 * 1024 * 1024)
    throw new SessionAttachmentUploadError("Session attachment upload exceeds the maximum size.", 413);
  const baseName = input.name.split(/[\\/]/).pop() ?? input.name;
  const dot = baseName.lastIndexOf(".");
  const extension = dot > 0 && dot < baseName.length - 1 ? baseName.slice(dot + 1).toLowerCase() : "";
  const contentType = input.mimeType?.split(";")[0]?.trim().toLowerCase();
  const supported = extension
    ? (supportedSessionAttachmentExtensions as readonly string[]).includes(extension)
    : Boolean(contentType && (supportedSessionAttachmentMimeTypes as readonly string[]).includes(contentType));
  if (!supported)
    throw new SessionAttachmentUploadError(
      "Session attachment type is not supported. Supported uploads: PDF, CSV, XLSX, TXT, Markdown, PNG, SVG, and code files.",
      415,
    );
  const file = await deps.fileService.upload({
    project_id: projectId,
    file_name: input.name,
    file_kind: SESSION_ATTACHMENT_FILE_KIND,
    data,
    mime_type: input.mimeType ?? null,
  });
  return toSessionAttachment(projectId, file);
};
