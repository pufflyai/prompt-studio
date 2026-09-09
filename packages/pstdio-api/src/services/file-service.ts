import type { createFilesDBService } from "pstdio-db";
import type { createFilesStorageService } from "pstdio-storage";
import type { EventBus } from "../features/sync/event-bus";

export type FileServiceDeps = {
  filesDBService: ReturnType<typeof createFilesDBService>;
  filesStorageService: ReturnType<typeof createFilesStorageService>;
  eventBus: EventBus;
};

export const createFileService = (deps: FileServiceDeps) => {
  const db = deps.filesDBService;
  const storage = deps.filesStorageService;

  const get = db.get;
  const list = db.list;
  const removeProjectStorage = storage.removeProjectStorage;

  const upload = async (
    input: {
      project_id: string;
      file_name: string;
      file_kind: string;
      data: Buffer;
      mime_type?: string | null;
    },
    initialize?: (file: NonNullable<Awaited<ReturnType<typeof db.get>>>) => Promise<void>,
  ) => {
    // Widen to the persisted column type so upload's inferred row matches reads.
    const id: string = crypto.randomUUID();
    const storagePath = storage.writeFile(input.project_id, id, input.data);
    const hash = storage.computeHash(input.data);
    const timestamp = new Date().toISOString();

    const file = {
      id,
      project_id: input.project_id,
      file_name: input.file_name,
      file_kind: input.file_kind,
      storage_path: storagePath,
      mime_type: input.mime_type ?? null,
      size_bytes: input.data.byteLength,
      hash,
      created_at: timestamp,
      updated_at: timestamp,
    };

    try {
      await db.insert(file);
      await initialize?.(file);
    } catch (error) {
      await db.remove(file.id);
      storage.deleteFile(storagePath);
      throw error;
    }
    deps.eventBus.emit("files", "set", file);

    return file;
  };

  const update = async (fileId: string, input: { data: Buffer }) => {
    const existing = await db.get(fileId);
    if (!existing) return null;

    // Overwrite the file at the existing storage path
    storage.writeFile(existing.project_id, fileId, input.data);

    const hash = storage.computeHash(input.data);
    const updated = {
      ...existing,
      size_bytes: input.data.byteLength,
      hash,
      updated_at: new Date().toISOString(),
    };

    await db.updateMetadata(fileId, {
      size_bytes: updated.size_bytes,
      hash: updated.hash,
      updated_at: updated.updated_at,
    });

    deps.eventBus.emit("files", "set", updated);
    return updated;
  };

  const remove = async (fileId: string) => {
    const existing = await db.get(fileId);
    if (!existing) return false;

    storage.deleteFile(existing.storage_path);
    await db.remove(fileId);
    deps.eventBus.emit("files", "delete", { id: fileId });

    return true;
  };

  return {
    get,
    list,
    upload,
    update,
    remove,
    removeProjectStorage,
  };
};
