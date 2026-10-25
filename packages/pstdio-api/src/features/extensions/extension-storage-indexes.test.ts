import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createDb, createExtensionStorageDBService, createProjectsDBService } from "pstdio-db";
import { normalizeExtensionSources } from "pstdio-extensions";
import { installExtensionStorageIndexes } from "./extension-storage-indexes";

const runtimeFor = (names: [string, string]) =>
  normalizeExtensionSources(
    names.map((name, i) => ({
      sourcePath: `/fixture/${i}/extension.ts`,
      sourceKind: "local_path" as const,
      packagePath: `/fixture/${i}`,
      manifest: {
        id: `example.index-${i}`,
        name: `index-${i}`,
        displayName: `Index ${i}`,
        version: "1.0.0",
        publisher: "example",
        main: "./extension.ts",
        enginesPstdio: "^0.3.0",
      },
      definition: { storageIndexes: [{ name, fields: { title: { path: ["title"], type: "string" as const } } }] },
    })),
  );

test("failed multi-extension index installation preserves every previous runtime query", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const { db } = connection;
    const project = await createProjectsDBService(db).create({ name: "Atomic index installation" });
    const service = createExtensionStorageDBService(db);
    await installExtensionStorageIndexes(service, project.id, runtimeFor(["old-a", "old-b"]));
    const storage = await service.open({ owner: { workbenchId: project.id, extensionId: "example.index-0" } });
    await storage.records.commit({ operationId: "seed", edits: [{ recordId: "one", replace: { title: "Saved" } }] });
    await db.execute(sql`ALTER TABLE storage_record_indexes ADD CONSTRAINT reject_new_b CHECK (name <> 'new-b')`);
    await expect(installExtensionStorageIndexes(service, project.id, runtimeFor(["new-a", "new-b"]))).rejects.toThrow();
    expect((await storage.records.query({ index: "old-a" })).records.map((record) => record.recordId)).toEqual(["one"]);
    const other = await service.open({ owner: { workbenchId: project.id, extensionId: "example.index-1" } });
    expect((await other.records.query({ index: "old-b" })).records).toEqual([]);
    await expect(storage.records.query({ index: "new-a" })).rejects.toThrow("not installed");
    await db.execute(sql`ALTER TABLE storage_record_indexes DROP CONSTRAINT reject_new_b`);
    await expect(
      installExtensionStorageIndexes(service, project.id, runtimeFor(["new-a", "new-b"]), () => {
        throw new Error("Candidate generation was superseded");
      }),
    ).rejects.toThrow("superseded");
    expect((await storage.records.query({ index: "old-a" })).records.map((record) => record.recordId)).toEqual(["one"]);
    expect((await other.records.query({ index: "old-b" })).records).toEqual([]);
    await installExtensionStorageIndexes(service, project.id, runtimeFor(["new-a", "new-b"]));
    expect((await storage.records.query({ index: "new-a" })).records.map((record) => record.recordId)).toEqual(["one"]);
    await expect(storage.records.query({ index: "old-a" })).rejects.toThrow("not installed");
  } finally {
    await connection.close();
  }
});

test("an index candidate accepted before invalidation owns the fallback if the next load fails", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createProjectExtensionRuntimeCatalog } = await import("./project-extension-runtime-catalog");
  const root = await mkdtemp(join(tmpdir(), "index-catalog-"));
  const connection = await createDb({ path: ":memory:" });
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "index-0",
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: "^0.3.0" },
      }),
    );
    await writeFile(join(root, "extension.ts"), "export default {};");
    const project = await createProjectsDBService(connection.db).create({ name: "Accepted catalog candidate" });
    const service = createExtensionStorageDBService(connection.db);
    let index = "old";
    let invalidateAccepted = false;
    let failNext = false;
    const published: number[] = [];
    const catalog = createProjectExtensionRuntimeCatalog({
      projectService: {
        get: async () => {
          if (failNext) throw new Error("Next load failed");
          return project;
        },
      } as never,
      workspaceService: { getDefault: async () => null } as never,
      extensionService: {
        listEnabledSourcesForProject: async () => [
          {
            instance: { id: "instance", namespace: "index-0", enabled: true },
            installedSource: {
              id: "source",
              extension_id: "example.index-0",
              source_kind: "local_path",
              source_path: root,
              status: "loaded",
            },
          },
        ],
      } as never,
      loadSources: async () => ({
        sources: [
          {
            sourcePath: join(root, "extension.ts"),
            sourceKind: "local_path",
            packagePath: root,
            manifest: {
              id: "example.index-0",
              name: "index-0",
              displayName: "Index",
              version: "1.0.0",
              publisher: "example",
              main: "./extension.ts",
              enginesPstdio: "^0.3.0",
            },
            definition: { storageIndexes: [{ name: index, fields: { title: { path: ["title"], type: "string" } } }] },
          },
        ],
        diagnostics: [],
      }),
      extensionStorageService: {
        installIndexes: async (owners, validate) => {
          await service.installIndexes(owners, validate);
          if (invalidateAccepted) {
            invalidateAccepted = false;
            failNext = true;
            catalog.invalidate({ projectId: project.id, reason: "source_changed" });
          }
        },
      },
      observer: { onPublish: ({ generation }) => published.push(generation) },
    });
    const original = await catalog.get(project.id);
    expect(original.runtime.extensions[0].definition.storageIndexes?.[0].name).toBe("old");
    index = "new";
    await writeFile(join(root, "extension.ts"), "export default { changed: true };");
    catalog.invalidate({ projectId: project.id, sourcePath: root, reason: "source_changed" });
    invalidateAccepted = true;
    const fallback = await catalog.get(project.id);
    expect(fallback.stale?.message).toBe("Next load failed");
    expect(fallback.runtime.extensions[0].definition.storageIndexes?.[0].name).toBe("new");
    expect(fallback.generation).toBe(original.generation + 1);
    expect(published).toEqual([original.generation, fallback.generation]);
    const storage = await service.open({ owner: { workbenchId: project.id, extensionId: "example.index-0" } });
    expect((await storage.records.query({ index: "new" })).records).toEqual([]);
  } finally {
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
