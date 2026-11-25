import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { inArray } from "drizzle-orm";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createExtensionUserDataDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
  createSessionsDBService,
  files,
} from "pstdio-db";
import { stopUnownedExtensionPreparation } from "pstdio-extensions";
import { createFilesStorageService } from "pstdio-storage";
import { EventBus } from "../features/sync/event-bus";
import { uninstallProjectExtension } from "./extension-uninstall";
import { createFileService } from "./file-service";
import { createSessionService } from "./session-service";

test.each([
  "direct",
  "session",
  "uninstall",
] as const)("reports committed %s deletion before deferred cleanup", async (mode) => {
  const root = await mkdtemp(join(tmpdir(), "file-committed-cleanup-"));
  const store = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(store.db).create({ name: "Deferred cleanup" });
    const db = createFilesDBService(store.db);
    const storage = createFilesStorageService(root);
    const removals = storage.fileRemovals(db.authority);
    const eventBus = new EventBus();
    let stagedPath: string | undefined;
    let failingFileId: string;
    const service = createFileService({
      filesDBService: db,
      eventBus,
      filesStorageService: {
        ...storage,
        fileRemovals: () => ({
          ...removals,
          async stage(file) {
            const prepared = await removals.stage(file);
            if (file.id !== failingFileId) return prepared;
            return {
              rollback: prepared.rollback,
              async commit() {
                const directory = dirname(file.storage_path);
                const entry = (await readdir(directory)).find((name) => name.includes(".pstdio-remove-"));
                expect(entry).toBeDefined();
                stagedPath = join(directory, entry!);
                await rename(stagedPath, `${stagedPath}.original`);
                await writeFile(stagedPath, "conflicting staging path");
                await prepared.commit();
              },
            };
          },
        }),
      },
    });
    const file = await service.upload({
      project_id: project.id,
      file_name: "saved.txt",
      file_kind: mode === "session" ? "session_messages" : "attachment",
      data: Buffer.from("original bytes"),
    });
    failingFileId = file.id;
    const remove = async () => {
      if (mode === "session") {
        const raw = createSessionsDBService(store.db);
        const session = await raw.create({
          project_id: project.id,
          title: "Recovery",
          agent: "test",
          status: "completed",
        });
        await raw.update(session.id, { session_file_id: file.id });
        const result = await createSessionService({ sessionsDb: raw, eventBus }).remove(session.id, service);
        return result.status === "removed" && (await raw.get(session.id)) === null;
      }
      if (mode === "uninstall") {
        const sources = createInstalledExtensionSourcesDBService(store.db);
        const instances = createExtensionInstancesDBService(store.db);
        const source = await sources.register({
          install_name: "cleanup",
          extension_id: "example.cleanup",
          display_name: "Cleanup fixture",
          source_kind: "local_path",
          source_path: join(root, "extension"),
        });
        const instance = await instances.create({
          installed_extension_id: source.id,
          scope_type: "project",
          scope_id: project.id,
        });
        const extra = await service.upload({
          project_id: project.id,
          file_name: "extra.txt",
          file_kind: "attachment",
          data: Buffer.from("also removed"),
        });
        await store.db
          .update(files)
          .set({ owner: source.extension_id })
          .where(inArray(files.id, [file.id, extra.id]));
        const result = await uninstallProjectExtension(
          {
            extensionInstancesService: instances,
            installedExtensionSourcesService: sources,
            extensionUserDataService: createExtensionUserDataDBService(store.db),
            recovery: createExtensionStorageDBService(store.db).recovery,
            eventBus,
            fileService: service,
            notifyInstalledSourcesChanged: async () => {},
          },
          { instanceId: instance.id, projectId: project.id, deleteUserData: true },
        );
        return Boolean(result) && (await instances.get(instance.id)) === null && (await db.get(extra.id)) === null;
      }
      return service.remove(file.id);
    };
    const outcome = await remove().catch(String);
    const removalEvents = () =>
      eventBus
        .getSince(0)
        .filter((e) => e.table === "files" && e.op === "delete" && (e.data as { id: string }).id === file.id);
    expect(await db.get(file.id)).toBeNull();
    expect(removalEvents()).toHaveLength(1);
    expect(await readFile(stagedPath!, "utf8")).toBe("conflicting staging path");
    expect(outcome).toBe(true);

    await rm(stagedPath!);
    await rename(`${stagedPath}.original`, stagedPath!);
    await service.recoverRemovals({ fileId: file.id });
    expect(await Bun.file(stagedPath!).exists()).toBe(false);
    expect(await Bun.file(file.storage_path).exists()).toBe(false);
    expect(removalEvents()).toHaveLength(1);
  } finally {
    if (mode === "uninstall") await stopUnownedExtensionPreparation();
    await store.close();
    await rm(root, { recursive: true, force: true });
  }
});

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
