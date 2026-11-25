import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { createFilesDBService } from "pstdio-db";
import type { createFilesStorageService } from "pstdio-storage";
import type { EventBus } from "../features/sync/event-bus";
import { apiLogger } from "../lib/logger";
import type { createProjectWork } from "./project-work";

export type FileServiceDeps = {
  filesDBService: ReturnType<typeof createFilesDBService>;
  filesStorageService: Pick<
    ReturnType<typeof createFilesStorageService>,
    "writeStream" | "writeFileAtPath" | "deleteFile" | "computeHash" | "discardUpload" | "fileRemovals"
  >;
  eventBus: EventBus;
  projectWork?: ReturnType<typeof createProjectWork>;
  removeOwnedBytes?: (id: string) => Promise<void>;
};

export const createFileService = (deps: FileServiceDeps) => {
  const db = deps.filesDBService;
  const storage = deps.filesStorageService;
  const removals = storage.fileRemovals(db.authority);
  const commitRemoval = async (fileId: string, staged?: Awaited<ReturnType<typeof removals.stage>>) => {
    deps.eventBus.emit("files", "delete", { id: fileId });
    try {
      await staged?.commit();
    } catch (error) {
      apiLogger.warn(
        { err: error, fileId, event: "file.removal.cleanup" },
        "File deletion committed with byte cleanup pending",
      );
    }
  };
  const recoverRemovals = async (filter?: { fileId?: string; projectId?: string; owner?: string }) => {
    const failures = await removals.recover(
      db.get,
      (file) =>
        (!filter?.fileId || file.id === filter.fileId) &&
        (!filter?.projectId || file.project_id === filter.projectId) &&
        (!filter?.owner || (file.owner !== null && canonicalExtensionId(file.owner) === filter.owner)),
    );
    if (filter && failures.length) throw failures[0].error;
    for (const failure of failures)
      apiLogger.warn(
        { err: failure.error, path: failure.path, event: "file.removal.recovery" },
        "File cleanup will retry on the next startup",
      );
  };
  const withProject = <T>(id: string, task: (signal?: AbortSignal) => Promise<T>, signal?: AbortSignal) =>
    deps.projectWork ? deps.projectWork.run(id, task, signal) : task(signal);

  const get = db.get;
  const list = db.list;
  const removeProjectStorage = async (projectId: string) => {
    for (const file of await db.list(projectId)) storage.deleteFile(file.storage_path);
  };

  const uploadFile = async (
    input: {
      project_id: string;
      id?: string;
      file_name: string;
      file_kind: string;
      data: Buffer | ReadableStream<Uint8Array>;
      mime_type?: string | null;
      signal?: AbortSignal;
    },
    initialize?: (file: NonNullable<Awaited<ReturnType<typeof db.get>>>) => Promise<void>,
  ) => {
    // Widen to the persisted column type so upload's inferred row matches reads.
    const id: string = input.id ?? crypto.randomUUID();
    const data =
      input.data instanceof ReadableStream
        ? input.data
        : new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(input.data as Buffer);
              controller.close();
            },
          });
    const stored = await storage.writeStream(input.project_id, id, data, input.signal);
    const timestamp = new Date().toISOString();

    const file = {
      id,
      project_id: input.project_id,
      file_name: input.file_name,
      file_kind: input.file_kind,
      storage_path: stored.storagePath,
      mime_type: input.mime_type ?? null,
      size_bytes: stored.byteLength,
      hash: stored.hash,
      created_at: timestamp,
      updated_at: timestamp,
    };

    try {
      await db.insert(file);
      await initialize?.(file);
    } catch (error) {
      await db.remove(file.id);
      storage.deleteFile(stored.storagePath);
      throw error;
    }
    deps.eventBus.emit("files", "set", file);

    return file;
  };

  const upload = (input: Parameters<typeof uploadFile>[0], initialize?: Parameters<typeof uploadFile>[1]) =>
    withProject(input.project_id, (signal) => uploadFile({ ...input, signal }, initialize), input.signal);

  const update = async (fileId: string, input: { data: Buffer }) => {
    await recoverRemovals({ fileId });
    const existing = await db.get(fileId);
    if (!existing) return null;

    return withProject(existing.project_id, async () => {
      const hash = storage.computeHash(input.data);
      const updated = {
        ...existing,
        size_bytes: input.data.byteLength,
        hash,
        updated_at: new Date().toISOString(),
      };

      const written = await db.updateMetadata(
        fileId,
        {
          size_bytes: updated.size_bytes,
          hash: updated.hash,
          updated_at: updated.updated_at,
        },
        (file) => storage.writeFileAtPath(file.storage_path, input.data),
      );
      if (!written) return null;

      deps.eventBus.emit("files", "set", updated);
      return updated;
    });
  };

  const remove = async (fileId: string) => {
    await recoverRemovals({ fileId });
    const existing = await db.get(fileId);
    if (!existing) return false;
    return withProject(existing.project_id, async () => {
      let staged: Awaited<ReturnType<typeof removals.stage>> | undefined;
      try {
        const removed = await db.remove(fileId, async (file) => {
          staged = await removals.stage(file);
        });
        if (!removed) return false;
      } catch (error) {
        try {
          await staged?.rollback();
        } catch (rollback) {
          throw new AggregateError([error, rollback], "File deletion failed and byte rollback is pending.");
        }
        throw error;
      }
      await commitRemoval(fileId, staged);
      return true;
    });
  };

  return {
    // Session removal deletes the file row in its own transaction. Restore its bytes if
    // that transaction fails; publish the file deletion only after the commit.
    prepareRemoval: async (file: NonNullable<Awaited<ReturnType<typeof get>>> & { owner?: string | null }) => {
      const staged = await removals.stage({ ...file, owner: file.owner ?? "pstdio" });
      return {
        rollback: staged.rollback,
        commit: () => commitRemoval(file.id, staged),
      };
    },
    recoverRemovals,
    get,
    list,
    upload,
    update,
    remove,
    discardUpload: async (projectId: string, fileId: string) => {
      const existing = await db.get(fileId);
      if (existing && existing.project_id !== projectId) throw new Error("Staged upload belongs to another project.");
      if (existing) await remove(fileId);
      else storage.discardUpload(projectId, fileId);
    },
    removeProjectStorage,
    removeOwnedBytes: (id: string) => deps.removeOwnedBytes?.(id),
  };
};
