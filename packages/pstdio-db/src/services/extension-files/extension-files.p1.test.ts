import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createFilesDBService } from "../files/files";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../projects/projects";
import { createExtensionFilesDBService } from "./extension-files";

test("extension files remain accessible after selecting another source for the same stable owner", async () => {
  const store = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(store.db).create({ name: "Files" });
    const sources = createInstalledExtensionSourcesDBService(store.db);
    const register = (suffix: string) =>
      sources.register({
        install_name: `files-${suffix}`,
        extension_id: "example.files",
        display_name: "Files",
        source_kind: "local_path",
        source_path: `/files-${suffix}`,
      });
    const initial = await register("a");
    const alternate = await register("b");
    const instances = createExtensionInstancesDBService(store.db);
    const before = await instances.create({
      installed_extension_id: initial.id,
      scope_type: "project",
      scope_id: project.id,
    });
    const stamp = "2026-11-20T12:00:00.000Z";
    const file = {
      id: crypto.randomUUID(),
      project_id: project.id,
      file_name: "Saved.md",
      file_kind: "extension",
      storage_path: "/saved.md",
      mime_type: "text/markdown",
      size_bytes: 10,
      hash: "hash",
      created_at: stamp,
      updated_at: stamp,
    };
    await createFilesDBService(store.db).insert(file);
    const service = createExtensionFilesDBService(store.db);
    const scope = {
      project_id: project.id,
      extension_instance_id: before.id,
      scope_type: "resource",
      scope_id: "drawing",
    };
    await service.attach({ ...scope, file_id: file.id });
    const [replacement] = await instances.activateProjectSources([
      {
        projectId: project.id,
        extensionId: alternate.extension_id,
        installedSourceId: alternate.id,
        instanceId: before.id,
      },
    ]);
    expect(await instances.list({ scope_id: project.id })).toEqual([replacement!.instance]);
    expect(await service.list({ ...scope, extension_instance_id: replacement!.instance.id })).toEqual([file]);
    expect(
      await service.getOwnedFile({ ...scope, extension_instance_id: replacement!.instance.id, file_id: file.id }),
    ).toEqual({
      ...file,
      scope_type: "resource",
      scope_id: "drawing",
    });
  } finally {
    await store.close();
  }
});
