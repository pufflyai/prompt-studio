import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createExtensionStorageDBService } from "./extension-storage";

let close: (() => Promise<void>) | undefined;
let svc: ReturnType<typeof createExtensionStorageDBService>;
let projectAId: string;
let projectBId: string;
let instanceAId: string;
let instanceBId: string;

const nowTimestamp = () => new Date().toISOString();

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  svc = createExtensionStorageDBService(result.db);
  const sources = createInstalledExtensionSourcesDBService(result.db);
  const instances = createExtensionInstancesDBService(result.db);

  const timestamp = nowTimestamp();
  projectAId = crypto.randomUUID();
  projectBId = crypto.randomUUID();
  await result.db.insert(projects).values([
    { id: projectAId, name: "A", shorthand: "A", created_at: timestamp, updated_at: timestamp },
    { id: projectBId, name: "B", shorthand: "B", created_at: timestamp, updated_at: timestamp },
  ]);

  const installed = await sources.register({
    install_name: "ext.example",
    extension_id: "ext.example",
    display_name: "Example",
    source_kind: "local_path",
    source_path: "/builtin/example",
  });

  const a = await instances.create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectAId,
    namespace: "example",
  });
  const b = await instances.create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectBId,
    namespace: "example",
  });
  instanceAId = a.id;
  instanceBId = b.id;
});

afterEach(async () => {
  await close?.();
});

describe("extensionStorageService", () => {
  test("project-owned KV is isolated by extension instance", async () => {
    await svc.setKv({
      project_id: projectAId,
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      key: "preference",
      value_json: { theme: "dark" },
    });

    await svc.setKv({
      project_id: projectBId,
      extension_instance_id: instanceBId,
      scope_type: "project",
      scope_id: projectBId,
      key: "preference",
      value_json: { theme: "light" },
    });

    const aValue = await svc.getKv(
      { extension_instance_id: instanceAId, scope_type: "project", scope_id: projectAId },
      "preference",
    );
    const bValue = await svc.getKv(
      { extension_instance_id: instanceBId, scope_type: "project", scope_id: projectBId },
      "preference",
    );

    expect(aValue?.value_json).toEqual({ theme: "dark" });
    expect(bValue?.value_json).toEqual({ theme: "light" });
  });

  test("collection items support insert, update, list, and delete", async () => {
    await svc.setCollectionItem({
      project_id: projectAId,
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "items",
      item_id: "alpha",
      value_json: { count: 1 },
      sort_order: 1,
    });
    await svc.setCollectionItem({
      project_id: projectAId,
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "items",
      item_id: "beta",
      value_json: { count: 2 },
      sort_order: 2,
    });

    let listed = await svc.listCollection({
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "items",
    });
    expect(listed.map((r) => r.item_id)).toEqual(["alpha", "beta"]);

    await svc.setCollectionItem({
      project_id: projectAId,
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "items",
      item_id: "alpha",
      value_json: { count: 99 },
      sort_order: 1,
    });
    const updatedAlpha = await svc.getCollectionItem(
      { extension_instance_id: instanceAId, scope_type: "project", scope_id: projectAId, collection: "items" },
      "alpha",
    );
    expect((updatedAlpha?.value_json as { count: number }).count).toBe(99);

    await svc.deleteCollectionItem(
      { extension_instance_id: instanceAId, scope_type: "project", scope_id: projectAId, collection: "items" },
      "alpha",
    );
    listed = await svc.listCollection({
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "items",
    });
    expect(listed).toHaveLength(1);
  });
});
