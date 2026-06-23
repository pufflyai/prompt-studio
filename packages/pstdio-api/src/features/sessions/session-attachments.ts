import { mkdir, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { FilePart, HarnessAttachment, SessionAttachment, SessionAttachmentRef } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";

type FileRow = NonNullable<Awaited<ReturnType<SessionsRouteDeps["fileService"]["get"]>>>;

export const SESSION_ATTACHMENT_FILE_KIND = "session_attachment";

export class SessionAttachmentError extends Error {}

// In-memory guard against deleting an attachment while its prompt is mid-submission.
// Scoped to a single API process; horizontal scaling would need a shared store.
const submittingAttachmentFileIds = new Set<string>();

export const sessionAttachmentContentUrl = (projectId: string, fileId: string) =>
  `/v1/projects/${encodeURIComponent(projectId)}/session-attachments/${encodeURIComponent(fileId)}/content`;

export const toSessionAttachment = (projectId: string, file: FileRow): SessionAttachment => ({
  file_id: file.id,
  name: file.file_name,
  mime_type: file.mime_type,
  size_bytes: file.size_bytes,
  hash: file.hash,
  url: sessionAttachmentContentUrl(projectId, file.id),
  created_at: file.created_at,
  updated_at: file.updated_at,
});

const isFileAlreadyExistsError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";

// Stored files are keyed by id with no extension, so an agent's Read tool would
// treat an image as raw text instead of loading it as an image. Expose the bytes
// through a path that keeps the original filename (and therefore its extension)
// so images load as images and other binaries are typed correctly.
const readableAttachmentPath = async (file: FileRow) => {
  const dir = join(tmpdir(), "pstdio-session-attachments", file.id);
  await mkdir(dir, { recursive: true });

  const readablePath = join(dir, basename(file.file_name));
  await rm(readablePath, { force: true });
  try {
    await symlink(file.storage_path, readablePath);
  } catch (error) {
    if (!isFileAlreadyExistsError(error)) throw error;
  }

  return readablePath;
};

export const resolveSessionAttachments = async (
  deps: Pick<SessionsRouteDeps, "fileService">,
  projectId: string,
  refs: SessionAttachmentRef[] = [],
) => {
  const attachments: HarnessAttachment[] = [];

  for (const ref of refs) {
    const file = await deps.fileService.get(ref.file_id);
    if (!file || file.project_id !== projectId || file.file_kind !== SESSION_ATTACHMENT_FILE_KIND) {
      throw new SessionAttachmentError(`Session attachment not found: ${ref.file_id}`);
    }

    attachments.push({
      fileId: file.id,
      fileName: file.file_name,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      localPath: await readableAttachmentPath(file),
      url: sessionAttachmentContentUrl(projectId, file.id),
    });
  }

  return attachments;
};

export const withResolvedSubmittingSessionAttachments = async <T>(
  deps: Pick<SessionsRouteDeps, "fileService">,
  projectId: string,
  refs: SessionAttachmentRef[] | undefined,
  operation: (attachments: HarnessAttachment[]) => Promise<T>,
) => {
  const fileIds = (refs ?? []).map((ref) => ref.file_id);

  for (const fileId of fileIds) {
    submittingAttachmentFileIds.add(fileId);
  }

  try {
    const attachments = await resolveSessionAttachments(deps, projectId, refs);
    return await operation(attachments);
  } finally {
    for (const fileId of fileIds) {
      submittingAttachmentFileIds.delete(fileId);
    }
  }
};

export const sessionAttachmentFileParts = (attachments: HarnessAttachment[]): FilePart[] =>
  attachments.map((attachment) => ({
    type: "file",
    fileId: attachment.fileId,
    filename: attachment.fileName,
    mediaType: attachment.mimeType ?? undefined,
    size: attachment.sizeBytes,
    url: attachment.url,
  }));

export const getProjectSessionAttachment = async (
  deps: Pick<SessionsRouteDeps, "fileService">,
  projectId: string,
  fileId: string,
) => {
  const file = await deps.fileService.get(fileId);
  if (!file || file.project_id !== projectId || file.file_kind !== SESSION_ATTACHMENT_FILE_KIND) return null;
  return file;
};

const entryReferencesFile = (entry: { attachments_json: SessionAttachmentRef[] | null }, fileId: string) =>
  (entry.attachments_json ?? []).some((attachment) => attachment.file_id === fileId);

const messageReferencesFile = (message: { parts: Array<{ type: string; fileId?: string }> }, fileId: string) =>
  message.parts.some((part) => part.type === "file" && part.fileId === fileId);

const activeSessionReferencesFile = (
  session: { id: string },
  deps: Pick<SessionsRouteDeps, "sessionService">,
  fileId: string,
) => deps.sessionService.store.get(session.id)?.submittedAttachmentFileIds.has(fileId) ?? false;

export const isMissingFileError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export const isSessionAttachmentSubmitted = async (
  deps: Pick<SessionsRouteDeps, "fileService" | "sessionQueueEntriesService" | "sessionService">,
  projectId: string,
  fileId: string,
) => {
  if (submittingAttachmentFileIds.has(fileId)) return true;

  const queueEntries = [
    ...(await deps.sessionQueueEntriesService.listPending()),
    ...(await deps.sessionQueueEntriesService.listDispatchStarted()),
  ];

  if (queueEntries.some((entry) => entryReferencesFile(entry, fileId))) return true;

  const sessions = await deps.sessionService.list(projectId, { includeArchived: true });
  if (sessions.some((session) => activeSessionReferencesFile(session, deps, fileId))) return true;

  for (const session of sessions) {
    if (!session.session_file_id) continue;

    const file = await deps.fileService.get(session.session_file_id);
    if (!file) continue;

    try {
      const messages = JSON.parse(await readFile(file.storage_path, "utf-8")) as Array<{
        parts: Array<{ type: string; fileId?: string }>;
      }>;
      if (messages.some((message) => messageReferencesFile(message, fileId))) return true;
    } catch (error) {
      if (isMissingFileError(error)) continue;
      throw error;
    }
  }

  return false;
};
