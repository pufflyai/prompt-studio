import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createActivityEventsDBService } from "../services/activity-events/activity-events";
import { createExtensionInstancesDBService } from "../services/extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../services/projects/projects";
import { createDb } from "./connection.pglite";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";
import { activity_events } from "./schemas.pg";

test("released extension registrations keep metadata, project enablement and activity references after upgrade", async () => {
  const root = await mkdtemp(join(tmpdir(), "extensions-upgrade-"));
  const path = join(root, "database");
  let store: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    store = await createDb({ path });
    const project = await createProjectsDBService(store.db).create({ name: "Released extension project" });
    const source = await createInstalledExtensionSourcesDBService(store.db).register({
      install_name: "drawings",
      extension_id: "example.drawings",
      display_name: "Drawings 日本語",
      source_kind: "local_path",
      source_path: "/extensions/drawings",
      version: "1.2.3",
      manifest_json: { name: "drawings", publisher: "example", version: "1.2.3" },
      source_hash: "original-source-hash",
      loaded_revision: "original-revision",
      last_loaded_at: "2026-11-20T12:00:00.000Z",
      last_error_json: { code: "original-diagnostic" },
      status: "error",
    });
    const instance = await createExtensionInstancesDBService(store.db).create({
      installed_extension_id: source.id,
      scope_type: "project",
      scope_id: project.id,
      enabled: false,
      config_json: { drawingColor: "blue" },
    });
    const event = await createActivityEventsDBService(store.db).create({
      projectId: project.id,
      resourceType: "drawing",
      resourceId: "drawing",
      sourceExtensionId: source.id,
      eventType: "created",
      actorType: "user",
      source: "api",
      summary: "Saved drawing",
      payloadJson: { title: "Original" },
    });
    const original = await createInstalledExtensionSourcesDBService(store.db).get(source.id);
    await restoreReleasedPreferenceTables(store);
    await store.close();
    store = await createDb({ path });
    const sources = createInstalledExtensionSourcesDBService(store.db);
    const instances = createExtensionInstancesDBService(store.db);
    expect(await sources.get(source.id)).toEqual(original);
    expect(await sources.getBySourcePath(source.source_path)).toEqual(original);
    expect(await instances.get(instance.id)).toEqual(instance);
    expect(await store.db.select().from(activity_events).where(eq(activity_events.id, event.id))).toEqual([event]);
    await expect(
      sources.register({
        install_name: "duplicate",
        extension_id: "example.duplicate",
        display_name: "Duplicate",
        source_kind: "local_path",
        source_path: source.source_path,
      }),
    ).rejects.toThrow();
    await instances.remove(instance.id);
    expect(await sources.remove(source.id)).toBe(true);
    expect(await store.db.select().from(activity_events).where(eq(activity_events.id, event.id))).toEqual([
      { ...event, source_extension_id: null },
    ]);
    await store.close();
    store = await createDb({ path });
    expect(await createInstalledExtensionSourcesDBService(store.db).get(source.id)).toBeNull();
  } finally {
    await store?.close();
    await rm(root, { recursive: true, force: true });
  }
});
