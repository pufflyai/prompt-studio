import { readFile } from "node:fs/promises";
import type { DeviceCommand, DeviceCommandAttachment } from "pstdio-api-contracts";
import type { Json } from "pstdio-sync-contracts";
import { uploadSessionAttachment } from "../../features/sessions/session-attachment-upload";
import {
  getProjectSessionAttachment,
  isSessionAttachmentSubmitted,
  toSessionAttachment,
} from "../../features/sessions/session-attachments";
import type { RelayDeps } from "./deps";

const submissions = new WeakMap<RelayDeps["fileService"], Map<string, Promise<void>>>();

export class DeviceCommandAttachmentError extends Error {
  constructor() {
    super("Session attachment not found on this device");
  }
}

const withAttachmentReservations = async <T>(deps: RelayDeps, fileIds: Set<string>, execute: () => Promise<T>) => {
  const reservations = submissions.get(deps.fileService) ?? new Map<string, Promise<void>>();
  submissions.set(deps.fileService, reservations);
  const previous = [...fileIds].flatMap((id) => reservations.get(id) ?? []);
  const release = Promise.withResolvers<void>();
  // Reserve the whole set before awaiting. Every dependency points to an earlier batch, preventing deadlocks.
  for (const id of fileIds) reservations.set(id, release.promise);
  await Promise.allSettled(previous);
  try {
    return await execute();
  } finally {
    release.resolve();
    for (const id of fileIds) if (reservations.get(id) === release.promise) reservations.delete(id);
  }
};

const importDeviceAttachment = async (deps: RelayDeps, projectId: string, command: DeviceCommandAttachment) => {
  const bytes = Buffer.from(command.data, "base64");
  const existing = await deps.fileService.get(command.fileId);
  if (existing) {
    const scoped = await getProjectSessionAttachment(deps, projectId, command.fileId);
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    if (!scoped || scoped.hash !== hash || scoped.file_name !== command.name || scoped.mime_type !== command.mimeType)
      return { status: 400, body: { error: "The attachment identity is already used by different content" } };
    return { status: 201, body: { ...toSessionAttachment(projectId, scoped), created: false } };
  }
  const attachment = await uploadSessionAttachment(deps, projectId, {
    fileId: command.fileId,
    name: command.name,
    data: bytes,
    mimeType: command.mimeType,
  });
  return { status: 201, body: { ...attachment, created: true } };
};

/** Bytes travel with their action, so a lost intermediate acknowledgement cannot orphan an import. */
export const withDeviceCommandAttachments = async (
  deps: RelayDeps,
  projectId: string,
  command: DeviceCommand,
  send: (command: DeviceCommand) => Promise<Json>,
) => {
  if (command.type !== "session.create" && command.type !== "session.followUp") return send(command);
  const attachmentContents: DeviceCommandAttachment[] = [];
  for (const fileId of new Set(command.input.attachments?.map(({ fileId }) => fileId))) {
    const file = await getProjectSessionAttachment(deps, projectId, fileId);
    if (!file) throw new DeviceCommandAttachmentError();
    attachmentContents.push({
      fileId,
      name: file.file_name,
      mimeType: file.mime_type,
      data: (await readFile(file.storage_path)).toString("base64"),
    });
  }
  return send(attachmentContents.length ? { ...command, attachmentContents } : command);
};

const removeUnsubmittedDeviceAttachment = async (deps: RelayDeps, projectId: string, fileId: string) => {
  const file = await getProjectSessionAttachment(deps, projectId, fileId);
  if (!file) return { status: 204, body: null };
  if (await isSessionAttachmentSubmitted(deps, projectId, fileId))
    return { status: 409, body: { error: "Session attachment is already submitted" } };
  await deps.fileService.remove(fileId);
  return { status: 204, body: null };
};

export const executeWithDeviceAttachments = async (
  deps: RelayDeps,
  projectId: string,
  command: DeviceCommand,
  execute: () => Promise<{ status: number; body: unknown }>,
) => {
  if (command.type !== "session.create" && command.type !== "session.followUp") return execute();
  const contents = command.attachmentContents ?? [];
  const refs = new Set(command.input.attachments?.map(({ fileId }) => fileId));
  if (
    new Set(contents.map(({ fileId }) => fileId)).size !== contents.length ||
    contents.some(({ fileId }) => !refs.has(fileId))
  )
    return { status: 400, body: { error: "Attachment contents must match the submitted references" } };
  return withAttachmentReservations(deps, refs, async () => {
    const copied: string[] = [];
    const cleanup = () =>
      Promise.allSettled(copied.map((fileId) => removeUnsubmittedDeviceAttachment(deps, projectId, fileId)));
    try {
      for (const attachment of contents) {
        const imported = await importDeviceAttachment(deps, projectId, attachment);
        if (imported.status !== 201) {
          await cleanup();
          return imported;
        }
        if ("created" in imported.body && imported.body.created) copied.push(attachment.fileId);
      }
      const result = await execute();
      if (result.status >= 400) await cleanup();
      return result;
    } catch (error) {
      await cleanup();
      throw error;
    }
  });
};
