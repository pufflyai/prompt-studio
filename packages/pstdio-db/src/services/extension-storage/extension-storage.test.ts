import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { scopeRecordStorage } from "pstdio-sync";
import type { createExtensionStorageDBService } from "./extension-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

let close: (() => Promise<void>) | undefined;
let svc: ReturnType<typeof createExtensionStorageDBService>;
let projectAId: string;
let projectBId: string;
let instanceAId: string;
let instanceBId: string;

beforeEach(async () => {
  ({ close, svc, projectAId, projectBId, instanceAId, instanceBId } = await createExtensionStorageFixture());
});

afterEach(async () => {
  await close?.();
});

test("legacy writes and records share one document and accept an earlier caller revision", async () => {
  const scope = { extension_instance_id: instanceAId, scope_type: "project", scope_id: projectAId };
  await svc.setKv({ ...scope, key: "setting", value_json: "legacy", project_id: projectAId });
  const storage = await svc.open({ owner: { workbenchId: projectAId, extensionId: "ext.example" } });
  const records = scopeRecordStorage(storage.records, ["project", projectAId, "kv"]);
  const observed = await records.read(records.id("setting"));
  expect(observed.value).toBe("legacy");
  await svc.setKv({ ...scope, key: "setting", value_json: "newer", project_id: projectAId });
  expect(
    (
      await records.commit({
        operationId: "stale",
        edits: [{ recordId: observed.recordId, expectedRevision: observed.revision, replace: "open caller" }],
      })
    ).status,
  ).toBe("saved-locally");
  expect((await svc.getKv(scope, "setting"))?.value_json).toBe("open caller");
});

test("legacy structured writes preserve JSON serialization of optional object and array values", async () => {
  const input = {
    project_id: projectAId,
    extension_instance_id: instanceAId,
    scope_type: "project",
    scope_id: projectAId,
    collection: "revisions",
    item_id: "revision",
  };
  const value = { title: "Artifact", favicon: undefined, nested: { label: undefined }, values: ["first", undefined] };
  expect(await svc.createCollectionItemIfAbsent({ ...input, value_json: value })).toBe(true);
  expect((await svc.getCollectionItem(input, input.item_id))?.value_json).toEqual({
    title: "Artifact",
    nested: {},
    values: ["first", null],
  });
  expect(await svc.updateCollectionItem({ ...input, value_json: { ...value, title: "Renamed" } })).toBe(true);
  expect(await svc.deleteCollectionItemIfValue(input, input.item_id, { ...value, title: "Renamed" })).toBe(true);
  await svc.setKv({ ...input, key: "optional", value_json: value });
  expect((await svc.getKv(input, "optional"))?.value_json).toEqual({
    title: "Artifact",
    nested: {},
    values: ["first", null],
  });
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

  test("collection item writes upsert the same key under concurrent inserts", async () => {
    const item = {
      project_id: projectAId,
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "items",
      item_id: "alpha",
      sort_order: 1,
    };

    await Promise.all([
      svc.setCollectionItem({ ...item, value_json: { count: 1 } }),
      svc.setCollectionItem({ ...item, value_json: { count: 2 } }),
    ]);

    const listed = await svc.listCollection({
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "items",
    });
    expect(listed).toHaveLength(1);
    expect([1, 2]).toContain((listed[0].value_json as { count: number }).count);
  });

  test("collection item create-if-absent keeps the first owner", async () => {
    const scope = {
      project_id: projectAId,
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "claims",
      item_id: "ticket-1",
    };

    const results = await Promise.all([
      svc.createCollectionItemIfAbsent({ ...scope, value_json: { owner: "run-1" } }),
      svc.createCollectionItemIfAbsent({ ...scope, value_json: { owner: "run-2" } }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const stored = await svc.getCollectionItem(scope, "ticket-1");
    expect([{ owner: "run-1" }, { owner: "run-2" }]).toContainEqual(stored?.value_json as { owner: string });
  });

  test("collection item conditional delete preserves a changed owner", async () => {
    const input = {
      project_id: projectAId,
      extension_instance_id: instanceAId,
      scope_type: "project",
      scope_id: projectAId,
      collection: "claims",
      item_id: "ticket-1",
    };
    await svc.setCollectionItem({ ...input, value_json: { owner: "new" } });

    expect(await svc.deleteCollectionItemIfValue(input, "ticket-1", { owner: "stale" })).toBe(false);
    expect(await svc.deleteCollectionItemIfValue(input, "ticket-1", { owner: "new" })).toBe(true);
  });
});

test("update-only collection writes preserve deletion and scope", async () => {
  const scope = {
    project_id: projectAId,
    extension_instance_id: instanceAId,
    scope_type: "project",
    scope_id: projectAId,
    collection: "items",
    item_id: "alpha",
  };
  await svc.setCollectionItem({ ...scope, value_json: { count: 1 } });
  expect(await svc.updateCollectionItem({ ...scope, value_json: { count: 2 } })).toBe(true);
  expect((await svc.getCollectionItem(scope, "alpha"))?.value_json).toEqual({ count: 2 });
  expect(await svc.updateCollectionItem({ ...scope, scope_id: projectBId, value_json: {} })).toBe(false);
  await Promise.all([
    svc.deleteCollectionItem(scope, "alpha"),
    svc.updateCollectionItem({ ...scope, value_json: { count: 3 } }),
  ]);
  expect(await svc.getCollectionItem(scope, "alpha")).toBeNull();
  expect(await svc.updateCollectionItem({ ...scope, value_json: {} })).toBe(false);
});
