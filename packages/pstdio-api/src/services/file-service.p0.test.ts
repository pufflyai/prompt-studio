import { describe, expect, mock, test } from "bun:test";
import { EventBus } from "../features/sync/event-bus";
import { createFileService, type FileServiceDeps } from "./file-service";

const mockFilesDBService = () => {
  const get = mock(async (id: string) => ({
    id,
    project_id: "p1",
    file_name: "test.txt",
    file_kind: "attachment",
    storage_path: `/tmp/p1/${id}`,
    mime_type: "text/plain" as string | null,
    size_bytes: 11,
    hash: "abc" as string | null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  }));
  return {
    authority: "test",
    list: mock(async () => []),
    get,
    insert: mock(async () => {}),
    updateMetadata: mock(
      async (
        id: string,
        _input: { size_bytes: number; hash: string; updated_at: string },
        beforeWrite?: Parameters<FileServiceDeps["filesDBService"]["updateMetadata"]>[2],
      ) => {
        await beforeWrite?.({ ...(await get(id)), owner: "pstdio", scope: null, path: null });
        return true;
      },
    ),
    remove: mock(async (id: string, beforeDelete?: Parameters<FileServiceDeps["filesDBService"]["remove"]>[1]) => {
      await beforeDelete?.({ ...(await get(id)), owner: "pstdio", scope: null, path: null });
      return true;
    }),
  } satisfies FileServiceDeps["filesDBService"];
};
const mockFilesStorageService = () => {
  const deleteFile = mock((_path: string) => {});
  return {
    writeFileAtPath: mock((_path: string, _data: Buffer) => {}),
    writeStream: mock(async (_pid: string, _fid: string, data: ReadableStream<Uint8Array>) => {
      const bytes = await new Response(data).arrayBuffer();
      return { storagePath: "/tmp/p1/file-id", byteLength: bytes.byteLength, hash: "fakehash" };
    }),
    discardUpload: mock((_projectId: string, _fileId: string) => {}),
    deleteFile,
    computeHash: mock(() => "fakehash"),
    fileRemovals: () => ({
      recover: async () => [],
      stage: async (file: { storage_path: string }) => ({
        rollback: async () => {},
        commit: async () => {
          deleteFile(file.storage_path);
        },
      }),
    }),
  } satisfies FileServiceDeps["filesStorageService"];
};

describe("FileService", () => {
  test("upload writes file to disk then inserts into db", async () => {
    const db = mockFilesDBService();
    const storage = mockFilesStorageService();
    const service = createFileService({ eventBus: new EventBus(), filesDBService: db, filesStorageService: storage });

    const data = Buffer.from("hello world");
    const result = await service.upload({
      project_id: "p1",
      file_name: "note.txt",
      file_kind: "attachment",
      data,
      mime_type: "text/plain",
    });

    expect(result).toMatchObject({ file_name: "note.txt", project_id: "p1", size_bytes: data.byteLength });
    expect(db.insert).toHaveBeenCalledWith(result);
  });

  test("update writes file and updates db metadata", async () => {
    const db = mockFilesDBService();
    const storage = mockFilesStorageService();
    const service = createFileService({ eventBus: new EventBus(), filesDBService: db, filesStorageService: storage });

    const data = Buffer.from("updated content");
    const result = await service.update("f1", { data });

    expect(storage.writeFileAtPath).toHaveBeenCalledWith("/tmp/p1/f1", data);
    expect(db.updateMetadata).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ size_bytes: data.byteLength }),
      expect.any(Function),
    );
    expect(result?.size_bytes).toBe(data.byteLength);
  });

  test("update returns null when file not found", async () => {
    const db = mockFilesDBService();
    db.get = mock(async () => null) as unknown as typeof db.get;
    const storage = mockFilesStorageService();
    const service = createFileService({ eventBus: new EventBus(), filesDBService: db, filesStorageService: storage });

    const result = await service.update("nonexistent", { data: Buffer.from("x") });

    expect(result).toBeNull();
  });

  test("remove deletes from disk and db", async () => {
    const db = mockFilesDBService();
    const storage = mockFilesStorageService();
    const service = createFileService({ eventBus: new EventBus(), filesDBService: db, filesStorageService: storage });

    const result = await service.remove("f1");

    expect(result).toBe(true);
    expect(storage.deleteFile).toHaveBeenCalledWith("/tmp/p1/f1");
    expect(db.remove).toHaveBeenCalledWith("f1", expect.any(Function));
  });
});
