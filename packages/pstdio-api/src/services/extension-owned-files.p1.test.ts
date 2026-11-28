import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionFilesDBService,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createFilesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { seedLegacyProjectExtension } from "pstdio-db/test-fixtures";
import { createFilesStorageService } from "pstdio-storage";
import { EventBus } from "../features/sync/event-bus";
import { uninstallProjectExtension } from "./extension-uninstall";
import { createFileService } from "./file-service";

for (const mode of ["storage-failure", "delete-failure", "other-provider"]) {
  const anotherProvider = mode === "other-provider";
  test(`owned file cleanup: ${mode}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "owned-file-cleanup-"));
    const store = await createDb({ path: ":memory:" });
    try {
      const project = await createProjectsDBService(store.db).create({ name: "Owned files" });
      const sources = createInstalledExtensionSourcesDBService(store.db);
      const instances = createExtensionInstancesDBService(store.db);
      const sourcePath = join(root, "source");
      await mkdir(sourcePath);
      const source = await sources.register({
        install_name: "files",
        extension_id: "example.files",
        display_name: "Files",
        source_kind: "local_path",
        source_path: sourcePath,
      });
      const instance = await instances.create({
        installed_extension_id: source.id,
        scope_type: "project",
        scope_id: project.id,
      });
      let remainingInstance = instance;
      if (anotherProvider) {
        // Retained same-ID attachments may exist in data written by earlier hosts.
        const other = await sources.register({
          install_name: "alternate-files",
          extension_id: "example.files",
          display_name: "Alternate",
          source_kind: "local_path",
          source_path: join(root, "other"),
        });
        remainingInstance = await seedLegacyProjectExtension(store, {
          extension_ref: other.id,
          project_id: project.id,
          enabled: false,
        });
      }
      const eventBus = new EventBus();
      const storage = createFilesStorageService(join(root, "storage"));
      let fail = mode === "storage-failure";
      const fileService = createFileService({
        filesDBService: createFilesDBService(store.db),
        filesStorageService: {
          ...storage,
          fileRemovals: (authority) => {
            const removals = storage.fileRemovals(authority);
            return {
              ...removals,
              stage: async (file) => {
                if (fail) throw new Error("File bytes unavailable");
                return removals.stage(file);
              },
            };
          },
        },
        eventBus,
      });
      const binding = createExtensionFilesDBService(store.db);
      const file = await fileService.upload(
        { project_id: project.id, file_name: "Saved.md", file_kind: "extension", data: Buffer.from("Keep this file") },
        (created) =>
          binding
            .attach({
              project_id: project.id,
              extension_instance_id: instance.id,
              scope_type: "project",
              scope_id: project.id,
              file_id: created.id,
            })
            .then(() => {}),
      );
      const deps = {
        extensionInstancesService: instances,
        installedExtensionSourcesService: sources,
        extensionUserDataService: createExtensionUserDataDBService(store.db),
        fileService,
        eventBus,
        recovery: { exclusive: async <T>(_id: string, task: () => Promise<T>) => task() },
        notifyInstalledSourcesChanged: async () => {},
      };
      const input = { projectId: project.id, instanceId: instance.id, deleteUserData: true };
      if (mode === "delete-failure")
        await store.pglite.exec(`
          CREATE FUNCTION reject_file_delete() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'Rejected file deletion'; END $$;
          CREATE TRIGGER reject_file_delete BEFORE DELETE ON files
          FOR EACH ROW EXECUTE FUNCTION reject_file_delete();
        `);
      const before = eventBus.seq;
      if (!anotherProvider) {
        await expect(uninstallProjectExtension(deps, input)).rejects.toThrow(
          mode === "delete-failure" ? "Failed query" : "File bytes unavailable",
        );
        expect(await instances.get(instance.id)).not.toBeNull();
        expect(
          await binding.getOwnedFile({ project_id: project.id, extension_instance_id: instance.id, file_id: file.id }),
        ).not.toBeNull();
        expect(await readFile(file.storage_path, "utf8")).toBe("Keep this file");
        expect(eventBus.getSince(before).filter((event) => event.table === "files" && event.op === "delete")).toEqual(
          [],
        );
        fail = false;
        if (mode === "delete-failure") await store.pglite.exec("DROP TRIGGER reject_file_delete ON files");
      }
      await uninstallProjectExtension(deps, input);
      if (anotherProvider) {
        expect(
          await binding.getOwnedFile({
            project_id: project.id,
            extension_instance_id: remainingInstance.id,
            file_id: file.id,
          }),
        ).not.toBeNull();
        expect(await readFile(file.storage_path, "utf8")).toBe("Keep this file");
        expect(eventBus.getSince(before).filter((event) => event.table === "files" && event.op === "delete")).toEqual(
          [],
        );
      } else {
        expect(await fileService.get(file.id)).toBeNull();
        expect(await Bun.file(file.storage_path).exists()).toBe(false);
        expect(
          eventBus
            .getSince(before)
            .filter((event) => event.table === "files" && event.op === "delete")
            .map((event) => event.data),
        ).toEqual([{ id: file.id }]);
      }
    } finally {
      await store.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}
