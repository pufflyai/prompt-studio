import { describe, expect, mock, test } from "bun:test";
import { createFileService, type FileServiceDeps } from "./file-service";

const mockFilesDBService = () =>
  ({
    list: mock(async () => []),
    get: mock(async (id: string) => ({
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
    })),
    insert: mock(async () => {}),
    updateMetadata: mock(async () => {}),
    remove: mock(async () => {}),
  }) satisfies FileServiceDeps["filesDBService"];

const mockFilesStorageService = () =>
  ({
    writeFile: mock((_pid: string, _fid: string, _data: Buffer) => "/tmp/p1/file-id"),
    deleteFile: mock(() => {}),
    removeProjectStorage: mock(() => {}),
    computeHash: mock(() => "fakehash"),
  }) satisfies FileServiceDeps["filesStorageService"];

describe("FileService", () => {
  test("get delegates to the db service", async () => {
    const db = mockFilesDBService();
    const storage = mockFilesStorageService();
    const service = createFileService({ filesDBService: db, filesStorageService: storage });

    const result = await service.get("f1");

    expect(result?.id).toBe("f1");
    expect(db.get).toHaveBeenCalledWith("f1");
  });

  test("list delegates to the db service", async () => {
    const db = mockFilesDBService();
    const storage = mockFilesStorageService();
    const service = createFileService({ filesDBService: db, filesStorageService: storage });

    await service.list("p1");

    expect(db.list).toHaveBeenCalledWith("p1");
  });

  test("upload writes file to disk then inserts into db", async () => {
    const db = mockFilesDBService();
    const storage = mockFilesStorageService();
    const service = createFileService({ filesDBService: db, filesStorageService: storage });

    const data = Buffer.from("hello world");
    const result = await service.upload({
      project_id: "p1",
      file_name: "note.txt",
      file_kind: "attachment",
      data,
      mime_type: "text/plain",
    });

    expect(storage.writeFile).toHaveBeenCalled();
    expect(storage.computeHash).toHaveBeenCalledWith(data);
    expect(db.insert).toHaveBeenCalled();
    expect(result.file_name).toBe("note.txt");
    expect(result.project_id).toBe("p1");
  });

  test("update writes file and updates db metadata", async () => {
    const db = mockFilesDBService();
    const storage = mockFilesStorageService();
    const service = createFileService({ filesDBService: db, filesStorageService: storage });

    const data = Buffer.from("updated content");
    const result = await service.update("f1", { data });

    expect(db.get).toHaveBeenCalledWith("f1");
    expect(storage.writeFile).toHaveBeenCalled();
    expect(storage.computeHash).toHaveBeenCalledWith(data);
    expect(db.updateMetadata).toHaveBeenCalled();
    expect(result?.size_bytes).toBe(data.byteLength);
  });

  test("update returns null when file not found", async () => {
    const db = mockFilesDBService();
    db.get = mock(async () => null) as unknown as typeof db.get;
    const storage = mockFilesStorageService();
    const service = createFileService({ filesDBService: db, filesStorageService: storage });

    const result = await service.update("nonexistent", { data: Buffer.from("x") });

    expect(result).toBeNull();
  });

  test("remove deletes from disk and db", async () => {
    const db = mockFilesDBService();
    const storage = mockFilesStorageService();
    const service = createFileService({ filesDBService: db, filesStorageService: storage });

    const result = await service.remove("f1");

    expect(result).toBe(true);
    expect(storage.deleteFile).toHaveBeenCalledWith("/tmp/p1/f1");
    expect(db.remove).toHaveBeenCalledWith("f1");
  });

  test("remove returns false when file not found", async () => {
    const db = mockFilesDBService();
    db.get = mock(async () => null) as unknown as typeof db.get;
    const storage = mockFilesStorageService();
    const service = createFileService({ filesDBService: db, filesStorageService: storage });

    const result = await service.remove("nonexistent");

    expect(result).toBe(false);
  });
});
