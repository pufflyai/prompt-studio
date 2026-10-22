import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import {
  extension_collection_items,
  extension_files,
  extension_kv,
  extension_skill_preferences,
  files,
  projects,
} from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createDocumentStorageDBService } from "../extension-storage/document-storage";
import { createExtensionStorageDBService } from "../extension-storage/extension-storage";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createExtensionUserDataDBService } from "./extension-user-data";

let close: (() => Promise<void>) | undefined;
let db: Awaited<ReturnType<typeof createDb>>["db"];
let svc: ReturnType<typeof createExtensionUserDataDBService>;
let projectId: string;
let instanceId: string;

const now = () => new Date().toISOString();

const seedAllTables = async () => {
  const timestamp = now();
  const fileId = crypto.randomUUID();
  await db.insert(files).values({
    id: fileId,
    project_id: projectId,
    file_name: "doc.md",
    file_kind: "document",
    storage_path: "doc.md",
    size_bytes: 1,
    created_at: timestamp,
    updated_at: timestamp,
  });
  await db.insert(extension_collection_items).values({
    project_id: projectId,
    extension_instance_id: instanceId,
    scope_type: "project",
    scope_id: projectId,
    collection: "tickets",
    item_id: "T-1",
    value_json: { title: "Keep me" },
    created_at: timestamp,
    updated_at: timestamp,
  });
  await db.insert(extension_kv).values({
    project_id: projectId,
    extension_instance_id: instanceId,
    scope_type: "project",
    scope_id: projectId,
    key: "k",
    value_json: { v: 1 },
    created_at: timestamp,
    updated_at: timestamp,
  });
  await db.insert(extension_files).values({
    id: crypto.randomUUID(),
    project_id: projectId,
    extension_instance_id: instanceId,
    file_id: fileId,
    scope_type: "project",
    scope_id: projectId,
    created_at: timestamp,
  });
  await db.insert(extension_skill_preferences).values({
    project_id: projectId,
    extension_instance_id: instanceId,
    skill_key: "skill",
    created_at: timestamp,
    updated_at: timestamp,
  });
};

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
  svc = createExtensionUserDataDBService(db);

  const timestamp = now();
  projectId = crypto.randomUUID();
  await db
    .insert(projects)
    .values({ id: projectId, name: "P", shorthand: "P", created_at: timestamp, updated_at: timestamp });

  const installed = await createInstalledExtensionSourcesDBService(db).register({
    install_name: "ext.example",
    extension_id: "ext.example",
    display_name: "Example",
    source_kind: "local_path",
    source_path: "/builtin/example",
  });
  const instance = await createExtensionInstancesDBService(db).create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectId,
  });
  instanceId = instance.id;
});

afterEach(async () => {
  await close?.();
});

describe("extensionUserDataService", () => {
  test("removing one provider preserves the stable owner while another disabled provider references it", async () => {
    const source = await createInstalledExtensionSourcesDBService(db).register({
      install_name: "other",
      extension_id: "ext.example",
      display_name: "Other",
      source_kind: "local_path",
      source_path: "/builtin/other",
    });
    const other = await createExtensionInstancesDBService(db).create({
      installed_extension_id: source.id,
      scope_type: "project",
      scope_id: projectId,
      enabled: false,
    });
    const storage = createExtensionStorageDBService(db);
    const scope = { extension_instance_id: other.id, scope_type: "project", scope_id: projectId };
    await storage.setKv({ ...scope, key: "retained-by-second", value_json: "keep" });
    await svc.deleteForInstance(instanceId);
    expect((await storage.getKv(scope, "retained-by-second"))?.value_json).toBe("keep");
    expect(await svc.hasUserData(other.id)).toBe(true);
  });
  test("document storage keeps the uninstall data guard and supports explicit data removal", async () => {
    const storage = createExtensionStorageDBService(db);
    await storage.setKv({
      extension_instance_id: instanceId,
      scope_type: "project",
      scope_id: projectId,
      key: "saved",
      value_json: "keep",
    });
    expect(await svc.hasUserData(instanceId)).toBe(true);
    await svc.deleteForInstance(instanceId);
    expect(await svc.hasUserData(instanceId)).toBe(false);
    expect(
      await storage.getKv(
        {
          extension_instance_id: instanceId,
          scope_type: "project",
          scope_id: projectId,
        },
        "saved",
      ),
    ).toBeNull();
  });
  test("declared text content keeps the uninstall guard and is removed by a data purge", async () => {
    const owner = { workbenchId: projectId, extensionId: "ext.example" };
    const text = createDocumentStorageDBService(db).openTextDocument({ owner, fileId: "note" });
    await text.save("Keep this text");
    expect(await svc.hasUserData(instanceId)).toBe(true);
    await svc.deleteForInstance(instanceId);
    expect(await svc.hasUserData(instanceId)).toBe(false);
    expect(await text.read()).toBe("");
    await text.save("New text");
    expect(await svc.hasUserData(instanceId)).toBe(true);
    expect(await text.read()).toBe("New text");
  });
  test("hasUserData is false when the instance owns nothing", async () => {
    expect(await svc.hasUserData(instanceId)).toBe(false);
  });

  test("hasUserData detects data in any owned table", async () => {
    await seedAllTables();
    expect(await svc.hasUserData(instanceId)).toBe(true);
  });

  test("deleteForInstance clears every owned table", async () => {
    await seedAllTables();
    await svc.deleteForInstance(instanceId);
    expect(await svc.hasUserData(instanceId)).toBe(false);
  });
});
test("migration metadata follows retained data and resets on an explicit data purge", async () => {
  const storage = createExtensionStorageDBService(db);
  const scope = { extension_instance_id: instanceId, scope_type: "project", scope_id: projectId };
  await storage.migrate(scope, 1, async () => {});
  expect(await svc.hasUserData(instanceId)).toBe(false);
  await storage.migrate(scope, 1, async () => {
    throw new Error("Retained instance lost its checkpoint");
  });
  await svc.deleteForInstance(instanceId);
  await storage.setKv({ ...scope, key: "new", value_json: "New data" });
  expect(await svc.hasUserData(instanceId)).toBe(true);
  expect((await storage.getKv(scope, "new"))?.value_json).toBe("New data");
  let previousVersion: number | undefined;
  await storage.migrate(scope, 1, async (previous) => {
    previousVersion = previous;
  });
  expect(previousVersion).toBe(0);
});
