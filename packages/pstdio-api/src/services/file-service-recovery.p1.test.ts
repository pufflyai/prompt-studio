import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, createFilesDBService, createProjectsDBService } from "pstdio-db";
import { createFilesStorageService } from "pstdio-storage";
import { EventBus } from "../features/sync/event-bus";
import { createFileService } from "./file-service";

test("an edit settles interrupted byte rollback before updating the file", async () => {
  const root = await mkdtemp(join(tmpdir(), "file-update-recovery-"));
  const store = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(store.db).create({ name: "Recovery" });
    const db = createFilesDBService(store.db);
    const storage = createFilesStorageService(root);
    const service = createFileService({ filesDBService: db, filesStorageService: storage, eventBus: new EventBus() });
    const file = await service.upload({
      project_id: project.id,
      file_name: "Saved.md",
      file_kind: "attachment",
      data: Buffer.from("before deletion"),
    });
    const staged = await storage.fileRemovals(db.authority).stage({ ...file, owner: "pstdio" });
    // A transient path conflict prevents rollback after the metadata survives.
    await writeFile(file.storage_path, "conflicting bytes");
    await expect(staged.rollback()).rejects.toThrow("conflicting bytes");
    await rm(file.storage_path);

    await service.update(file.id, { data: Buffer.from("edited after recovery") });
    expect(await readFile(file.storage_path, "utf8")).toBe("edited after recovery");
    expect(await service.remove(file.id)).toBe(true);
    expect(await service.get(file.id)).toBeNull();
    expect(await Bun.file(file.storage_path).exists()).toBe(false);
  } finally {
    await store.close();
    await rm(root, { recursive: true, force: true });
  }
});
