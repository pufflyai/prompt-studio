import { readFile } from "node:fs/promises";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

type ExtensionFileRow = NonNullable<Awaited<ReturnType<ExtensionsRouteDeps["extensionFileService"]["getOwnedFile"]>>>;

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
    signal?: AbortSignal;
    scopeType: string;
    scopeId: string | null;
  },
): CommandRunnerEnvironment["storage"]["files"] => ({
  async put(fileInput) {
    const file = await deps.extensionFileService.upload({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
      file_name: fileInput.name,
      data: toBuffer(fileInput.data),
      mime_type: fileInput.mimeType ?? null,
    });
    if (!file) throw new Error(`Extension instance not found: ${input.extensionInstanceId}`);
    return toExtensionBlobRef(input.projectId, input.extensionInstanceId, file);
  },
  async get(id) {
    input.signal?.throwIfAborted();
    const file = await deps.extensionFileService.getOwnedFile({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    input.signal?.throwIfAborted();
    return file ? toExtensionBlobRef(input.projectId, input.extensionInstanceId, file) : undefined;
  },
  async getBytes(id) {
    input.signal?.throwIfAborted();
    const file = await deps.extensionFileService.getOwnedFile({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
    if (!file) throw new Error(`Extension file not found: ${id}`);
    input.signal?.throwIfAborted();
    return new Uint8Array(await readFile(file.storage_path, { signal: input.signal }));
  },
  async list() {
    input.signal?.throwIfAborted();
    const files = await deps.extensionFileService.list({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
    });
    if (!files) throw new Error(`Extension instance not found: ${input.extensionInstanceId}`);
    input.signal?.throwIfAborted();
    return files.map((file) => toExtensionBlobRef(input.projectId, input.extensionInstanceId, file));
  },
  async delete(id) {
    await deps.extensionFileService.remove({
      project_id: input.projectId,
      extension_instance_id: input.extensionInstanceId,
      file_id: id,
    });
  },
  urlFor(id) {
    return extensionFileUrl(input.projectId, input.extensionInstanceId, id);
  },
});
