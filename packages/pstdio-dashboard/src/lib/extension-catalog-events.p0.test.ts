import { expect, test } from "bun:test";
import { createScopedQueryClient, viewDataEvents } from "@pstdio/sdk/extensions";
import { emptyWorkbenchExtensionMetadata } from "@pstdio/workbench/extensions";
import { getProjectExtensionQueries } from "@/shared/extensions/project-extension-queries";
import { subscribeExtensionCatalogChanges } from "./extension-catalog-events";
import { createRuntimeCollections } from "./sync/collections";

test("preparing another extension preserves an open note while its own source changes refresh it", async () => {
  const owner = createRuntimeCollections();
  const queries = createScopedQueryClient({ runtimeId: "catalog-test", extensionId: "pstdio" });
  let reads = 0;
  const note = queries.forScope({ projectId: "project", extensionId: "pstdio.notes" }).query({
    id: "note",
    dependsOn: [viewDataEvents.extensionCatalogChanged.id],
    read: () => ++reads,
  });
  let catalogReads = 0;
  const catalog = getProjectExtensionQueries("project", {
    owner,
    queries,
    loadMetadata: async () => {
      catalogReads++;
      return emptyWorkbenchExtensionMetadata;
    },
  }).metadata;
  const stop = subscribeExtensionCatalogChanges(owner, (event) => queries.invalidate({ ...event, type: "changed" }));
  const sources = owner.getWriter("installed_extension_sources")!;
  try {
    expect(await note.read()).toBe(1);
    await catalog.read();
    sources.upsert({ id: "home", extension_id: "pstdio.pstdio-home" });
    await Promise.resolve();
    expect(await note.read()).toBe(1);
    await catalog.read();
    expect(catalogReads).toBe(2);
    sources.upsert({ id: "notes", extension_id: "pstdio.pstdio-notes" });
    await Promise.resolve();
    expect(await note.read()).toBe(2);
    await catalog.read();
    expect(catalogReads).toBe(3);
    const instances = owner.getWriter("extension_instances")!;
    instances.upsert({
      id: "other-project",
      installed_extension_id: "notes",
      scope_type: "project",
      scope_id: "other",
    });
    await Promise.resolve();
    expect(await note.read()).toBe(2);
    await catalog.read();
    expect(catalogReads).toBe(3);
    instances.upsert({
      id: "this-project",
      installed_extension_id: "notes",
      scope_type: "project",
      scope_id: "project",
    });
    await Promise.resolve();
    expect(await note.read()).toBe(3);
    await catalog.read();
    expect(catalogReads).toBe(4);
  } finally {
    stop();
    queries.dispose();
    await owner.dispose();
  }
});

test("catalog changes coalesce by actual project scope, retain moves, and ignore equal rows", async () => {
  const owner = createRuntimeCollections();
  const writer = owner.getWriter("extension_instances")!;
  const sources = owner.getWriter("installed_extension_sources")!;
  const source = { id: "installed", manifest_json: { views: [{ id: "note-editor" }] } };
  const events: unknown[] = [];
  const a = { id: "extension", scope_type: "project", scope_id: "a", enabled: true, settings: { theme: "light" } };
  writer.upsert(a);
  sources.upsert(source);
  const stop = subscribeExtensionCatalogChanges(owner, (event) => events.push(event));
  try {
    writer.upsert(a);
    await Promise.resolve();
    expect(events).toEqual([]);
    // Sync decodes a fresh JSON object even when an instance's configuration is unchanged.
    writer.upsert(JSON.parse(JSON.stringify(a)));
    sources.upsert(JSON.parse(JSON.stringify(source)));
    await Promise.resolve();
    expect(events).toEqual([]);
    writer.upsert({ ...a, settings: { theme: "dark" } });
    await Promise.resolve();
    expect(events).toEqual([{ id: "view.extension-catalog.changed", projectId: "a" }]);
    events.length = 0;
    sources.upsert({ ...source, manifest_json: { views: [{ id: "other-editor" }] } });
    await Promise.resolve();
    expect(events).toEqual([{ id: "view.extension-catalog.changed", projectId: undefined }]);
    events.length = 0;
    for (let index = 0; index < 1000; index++) writer.upsert({ ...a, scope_id: "b", enabled: false });
    await Promise.resolve();
    expect(events).toEqual([
      { id: "view.extension-catalog.changed", projectId: "a" },
      { id: "view.extension-catalog.changed", projectId: "b" },
    ]);
    events.length = 0;
    owner.getWriter("installed_extension_sources")!.upsert({ id: "global-source" });
    writer.upsert({ ...a, enabled: false });
    await Promise.resolve();
    expect(events).toEqual([{ id: "view.extension-catalog.changed", projectId: undefined }]);
    stop();
    writer.remove(a.id);
    await Promise.resolve();
    expect(events).toHaveLength(1);
  } finally {
    stop();
    await owner.dispose();
  }
});
