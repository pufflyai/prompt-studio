import { expect, test } from "bun:test";
import { subscribeExtensionCatalogChanges } from "./extension-catalog-events";
import { createRuntimeCollections } from "./sync/collections";

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
