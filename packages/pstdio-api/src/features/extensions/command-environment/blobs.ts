import { readFileSync } from "node:fs";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

type ExtensionFileRow = NonNullable<Awaited<ReturnType<ExtensionsRouteDeps["fileService"]["get"]>>>;

const extensionFileUrl = (projectId: string, extensionInstanceId: string, fileId: string) =>
  `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(extensionInstanceId)}/files/${encodeURIComponent(fileId)}/content`;

const toExtensionBlobRef = (projectId: string, extensionInstanceId: string, file: ExtensionFileRow) => ({
  id: file.id,
  name: file.file_name,
  mimeType: file.mime_type,
  size: file.size_bytes,
  hash: file.hash,
  url: extensionFileUrl(projectId, extensionInstanceId, file.id),
  createdAt: file.created_at,
  updatedAt: file.updated_at,
});

const toBuffer = (data: Uint8Array | ArrayBuffer) =>
  Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data));

export const createExtensionBlobsApi = (
  deps: ExtensionsRouteDeps,
  input: {
    extensionInstanceId: string;
    projectId: string;
    scopeType: string;
    scopeId: string | null;
  },
): CommandRunnerEnvironment["storage"]["files"] => ({
  async put(fileInput) {
    const file = await deps.fileService.upload({
      project_id: input.projectId,
      file_name: fileInput.name,
      file_kind: "extension",
      data: toBuffer(fileInput.data),
      mime_type: fileInput.mimeType ?? null,
    });
    await deps.extensionFilesService.attach({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: file.id,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
    });
    deps.eventBus?.emit("files", "set", file);
    return toExtensionBlobRef(input.projectId, input.extensionInstanceId, file);
  },
  async get(id) {
    const file = await deps.extensionFilesService.getOwnedFile({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    return file ? toExtensionBlobRef(input.projectId, input.extensionInstanceId, file) : undefined;
  },
  async getBytes(id) {
    const file = await deps.extensionFilesService.getOwnedFile({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    if (!file) throw new Error(`Extension file not found: ${id}`);
    return new Uint8Array(readFileSync(file.storage_path));
  },
  async list() {
    const files = await deps.extensionFilesService.list({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
    });
    return files.map((file) => toExtensionBlobRef(input.projectId, input.extensionInstanceId, file));
  },
  async delete(id) {
    const file = await deps.extensionFilesService.getOwnedFile({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    if (!file) return;
    await deps.extensionFilesService.detach({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    await deps.fileService.remove(id);
    deps.eventBus?.emit("files", "delete", { id });
  },
  urlFor(id) {
    return extensionFileUrl(input.projectId, input.extensionInstanceId, id);
  },
});
