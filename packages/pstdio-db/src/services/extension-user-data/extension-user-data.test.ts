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
