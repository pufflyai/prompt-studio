import type {
  createExtensionFilesDBService,
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createInstalledExtensionSourcesDBService,
} from "pstdio-db";
import type { StorageOwner } from "pstdio-sync";
import { initialRecordRevision, storageRecordId } from "pstdio-sync";
import { z } from "zod";
import { createRecordAssets } from "../features/extensions/command-environment/record-assets";
import type { createAssetTransferService } from "./asset-transfer-service";
import type { createFileService } from "./file-service";
import { createBlobOwnerResolver } from "./shared-files/blob-owner";

export type ExtensionFileServiceDeps = {
  extensionFilesDBService: ReturnType<typeof createExtensionFilesDBService>;
  extensionInstancesDBService: Pick<ReturnType<typeof createExtensionInstancesDBService>, "get" | "list">;
  installedExtensionSourcesDBService: Pick<ReturnType<typeof createInstalledExtensionSourcesDBService>, "get">;
  extensionStorageService: ReturnType<typeof createExtensionStorageDBService>;
  assetTransferService: ReturnType<typeof createAssetTransferService>;
  fileService: Pick<ReturnType<typeof createFileService>, "remove" | "upload">;
};
interface ExtensionFileScope {
  project_id: string;
  extension_instance_id: string;
  scope_type: string;
  scope_id: string | null;
}
interface OwnedFileRef {
  project_id: string;
  extension_instance_id: string;
  file_id: string;
}
const metadata = z.strictObject({
  name: z.string(),
  mimeType: z.string().nullable(),
  scopeType: z.string(),
  scopeId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const recordId = (id: string) => storageRecordId(["blob-file"], id);

export const createExtensionFileService = (deps: ExtensionFileServiceDeps) => {
  const resolve = createBlobOwnerResolver(deps);
  const open = (owner: StorageOwner) =>
    deps.extensionStorageService.open({ owner, assets: createRecordAssets(deps.assetTransferService, owner) });
  const fileRow = (
    owner: StorageOwner,
    record: Awaited<ReturnType<Awaited<ReturnType<typeof open>>["records"]["read"]>>,
  ) => {
    if (!record.exists || record.deleted || !record.asset) return null;
    const value = metadata.parse(record.value);
    const identity = JSON.parse(record.recordId) as string[];
    if (identity.length !== 2 || identity[0] !== "blob-file") throw new Error("Invalid blob file identity");
    return {
      id: identity[1]!,
      project_id: owner.workbenchId,
      extension_id: owner.extensionId,
      file_name: value.name,
      file_kind: "extension",
      mime_type: value.mimeType,
      size_bytes: record.asset.byteLength,
      hash: record.asset.sha256,
      created_at: value.createdAt,
      updated_at: value.updatedAt,
      asset: record.asset,
    };
  };
  const importFile = async (
    owner: StorageOwner,
    instanceId: string,
    file: NonNullable<Awaited<ReturnType<ExtensionFileServiceDeps["extensionFilesDBService"]["getOwnedFile"]>>>,
  ) => {
    const storage = await open(owner);
    const id = recordId(file.id);
    const current = await storage.records.read(id);
    if (!current.exists) {
      const asset = await deps.assetTransferService.stage(owner, crypto.randomUUID(), Bun.file(file.storage_path));
      await storage.records.commit({
        operationId: crypto.randomUUID(),
        edits: [
          {
            recordId: id,
            expectedRevision: initialRecordRevision(owner, id),
            replace: {
              name: file.file_name,
              mimeType: file.mime_type,
              scopeType: file.scope_type,
              scopeId: file.scope_id,
              createdAt: file.created_at,
              updatedAt: file.updated_at,
            },
            asset,
            deleted: false,
          },
        ],
      });
    }
    // The durable asset and journal entry replace the old local file row. Retrying a crash is idempotent.
    await deps.fileService.remove(file.id);
    await deps.extensionFilesDBService.detach({
      project_id: owner.workbenchId,
      extension_instance_id: instanceId,
      file_id: file.id,
    });
  };
  const upload = async (
    input: ExtensionFileScope & {
      file_name: string;
      data: Buffer | ReadableStream<Uint8Array>;
      mime_type?: string | null;
      signal?: AbortSignal;
    },
  ) => {
    const resolved = await resolve(input);
    if (!resolved) return null;
    const { owner, instanceId } = resolved;
    const file = await deps.fileService.upload({ ...input, file_kind: "extension" }, async (file) => {
      await deps.extensionFilesDBService.attach({ ...input, extension_instance_id: instanceId, file_id: file.id });
    });
    await importFile(owner, instanceId, { ...file, scope_type: input.scope_type, scope_id: input.scope_id });
    return fileRow(owner, await (await open(owner)).records.read(recordId(file.id)));
  };
  const list = async (input: ExtensionFileScope) => {
    const resolved = await resolve(input);
    if (!resolved) return null;
    const localScope = { ...input, extension_instance_id: resolved.instanceId };
    for (const file of await deps.extensionFilesDBService.list(localScope))
      await importFile(resolved.owner, resolved.instanceId, {
        ...file,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
      });
    const storage = await open(resolved.owner);
    const files = [];
    for (const record of await storage.records.list()) {
      if (!record.recordId.startsWith('["blob-file",')) continue;
      const value = metadata.parse(record.value);
      if (value.scopeType !== input.scope_type || value.scopeId !== input.scope_id) continue;
      const file = fileRow(resolved.owner, record);
      if (file) files.push(file);
    }
    return files.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  };
  const getOwnedFile = async (input: OwnedFileRef) => {
    const resolved = await resolve(input);
    if (!resolved) return null;
    const local = await deps.extensionFilesDBService.getOwnedFile({
      ...input,
      extension_instance_id: resolved.instanceId,
    });
    if (local) await importFile(resolved.owner, resolved.instanceId, local);
    const storage = await open(resolved.owner);
    return fileRow(resolved.owner, await storage.records.read(recordId(input.file_id)));
  };
  const remove = async (input: OwnedFileRef) => {
    const file = await getOwnedFile(input);
    if (!file) return false;
    const storage = await open({ workbenchId: input.project_id, extensionId: file.extension_id });
    const record = await storage.records.read(recordId(file.id));
    await storage.records.commit({
      operationId: crypto.randomUUID(),
      edits: [{ recordId: record.recordId, expectedRevision: record.revision, deleted: true, asset: null }],
    });
    return true;
  };
  const read = (file: NonNullable<Awaited<ReturnType<typeof getOwnedFile>>>, signal?: AbortSignal) =>
    deps.assetTransferService.read(
      { workbenchId: file.project_id, extensionId: file.extension_id },
      file.asset,
      signal,
    );
  return { upload, list, getOwnedFile, remove, read };
};
