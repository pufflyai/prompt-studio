import { readFile } from "node:fs/promises";
import { type DeviceCommand, deviceCommandResultSchema } from "pstdio-api-contracts";
import type { Json } from "pstdio-sync-contracts";
import { uploadSessionAttachment } from "../../features/sessions/session-attachment-upload";
import {
  getProjectSessionAttachment,
  isSessionAttachmentSubmitted,
  toSessionAttachment,
} from "../../features/sessions/session-attachments";
import type { RelayDeps } from "./deps";

const copying = new WeakMap<RelayDeps["fileService"], Map<string, Promise<unknown>>>();

export const importDeviceAttachment = (
  deps: RelayDeps,
  command: Extract<DeviceCommand, { type: "session.copyAttachment" }>,
) => {
  const operations = copying.get(deps.fileService) ?? new Map<string, Promise<unknown>>();
  copying.set(deps.fileService, operations);
  const key = command.fileId;
  const pending = (operations.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const bytes = Buffer.from(command.data, "base64");
      const existing = await deps.fileService.get(command.fileId);
      if (existing) {
        const scoped = await getProjectSessionAttachment(deps, command.projectId, command.fileId);
        const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
        if (
          !scoped ||
          scoped.hash !== hash ||
          scoped.file_name !== command.name ||
          scoped.mime_type !== command.mimeType
        )
          return { status: 400, body: { error: "The attachment identity is already used by different content" } };
        return { status: 201, body: { ...toSessionAttachment(command.projectId, scoped), created: false } };
      }
      const attachment = await uploadSessionAttachment(deps, command.projectId, {
        fileId: command.fileId,
        name: command.name,
        data: bytes,
        mimeType: command.mimeType,
      });
      return { status: 201, body: { ...attachment, created: true } };
    });
  operations.set(key, pending);
  void pending
    .finally(() => {
      if (operations.get(key) === pending) operations.delete(key);
    })
    .catch(() => {});
  return pending;
};

const copyDeviceAttachments = async (
  deps: RelayDeps,
  projectId: string,
  command: DeviceCommand,
  send: (command: DeviceCommand) => Promise<Json>,
  copied: string[],
) => {
  if (command.type !== "session.create" && command.type !== "session.followUp") return;
  for (const { fileId } of command.input.attachments ?? []) {
    const file = await getProjectSessionAttachment(deps, projectId, fileId);
    if (!file) throw new Error("Session attachment not found on this device");
    const result = deviceCommandResultSchema.parse(
      await send({
        type: "session.copyAttachment",
        projectId,
        fileId,
        name: file.file_name,
        mimeType: file.mime_type,
        data: (await readFile(file.storage_path)).toString("base64"),
      }),
    );
    if (result.status !== 201) throw new Error("The attachment could not be copied to the device");
    if (result.body && typeof result.body === "object" && "created" in result.body && result.body.created)
      copied.push(fileId);
  }
};

export const removeUnsubmittedDeviceAttachment = async (deps: RelayDeps, projectId: string, fileId: string) => {
  const file = await getProjectSessionAttachment(deps, projectId, fileId);
  if (!file) return { status: 204, body: null };
  if (await isSessionAttachmentSubmitted(deps, projectId, fileId))
    return { status: 409, body: { error: "Session attachment is already submitted" } };
  await deps.fileService.remove(fileId);
  return { status: 204, body: null };
};

export const withDeviceCommandAttachments = async (
  deps: RelayDeps,
  projectId: string,
  command: DeviceCommand,
  send: (command: DeviceCommand, signal?: AbortSignal) => Promise<Json>,
) => {
  const copied: string[] = [];
  const cleanup = () =>
    Promise.allSettled(
      copied.map((fileId) =>
        send({ type: "session.removeUnsubmittedAttachment", projectId, fileId }, new AbortController().signal),
      ),
    );
  try {
    await copyDeviceAttachments(deps, projectId, command, send, copied);
    const result = await send(command);
    if (deviceCommandResultSchema.parse(result).status >= 400) await cleanup();
    return result;
  } catch (error) {
    await cleanup();
    throw error;
  }
};
