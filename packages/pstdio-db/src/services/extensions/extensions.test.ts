import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb, extension_collection_items, extension_kv } from "../../index";
import { createProjectsDBService } from "../projects/projects";
import {
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createExtensionTemplatePreferencesDBService,
} from "./extensions";

let close: () => Promise<void>;
let db: Awaited<ReturnType<typeof createDb>>["db"];
let projectId: string;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;

  const project = await createProjectsDBService(db).create({ name: "extension-storage" });
  projectId = project.id;
});

afterEach(async () => {
  await close?.();
});

describe("createExtensionInstancesDBService", () => {
  test("creates, updates, disables, and enables project extension instances", async () => {
    const service = createExtensionInstancesDBService(db);

    const created = await service.create({
      project_id: projectId,
      extension_id: "local.review",
      display_name: "Review",
      source_kind: "local",
      local_path: ".pstdio/extensions/local.review",
      config_json: { severity: "high" },
    });

    expect(created.enabled).toBe(true);
    expect(created.config_json).toEqual({ severity: "high" });
    expect(await service.list(projectId)).toHaveLength(1);

    const updated = await service.update(projectId, "local.review", {
      display_name: "Review v2",
      config_json: { severity: "low" },
    });
    expect(updated?.display_name).toBe("Review v2");
    expect(updated?.config_json).toEqual({ severity: "low" });

    expect((await service.disable(projectId, "local.review"))?.enabled).toBe(false);
    expect((await service.enable(projectId, "local.review"))?.enabled).toBe(true);
  });

  test("keeps one instance per project and extension id", async () => {
    const service = createExtensionInstancesDBService(db);

    await service.create({
      project_id: projectId,
      extension_id: "local.review",
      display_name: "Review",
      source_kind: "local",
      local_path: ".pstdio/extensions/local.review",
    });

    await expect(
      service.create({
        project_id: projectId,
        extension_id: "local.review",
        display_name: "Review again",
        source_kind: "local",
        local_path: ".pstdio/extensions/local.review",
      }),
    ).rejects.toThrow();
  });
});

describe("createExtensionStorageDBService", () => {
  test("stores KV and collection records by project, extension, and scope", async () => {
    const storage = createExtensionStorageDBService(db);
    const scope = {
      project_id: projectId,
      extension_id: "local.review",
      scope_type: "ticket",
      scope_id: "PS-86",
    };

    await storage.set(scope, "lastRun", { status: "passed" });
    await storage.set({ ...scope, extension_id: "local.other" }, "lastRun", { status: "ignored" });

    expect(await storage.get(scope, "lastRun")).toEqual({ status: "passed" });

    const collection = storage.collection(scope, "statuses");
    await collection.put("backlog", { label: "Backlog" });
    await collection.put("ready", { label: "Ready" });

    expect(await collection.get("ready")).toEqual({ label: "Ready" });
    expect(await collection.list()).toEqual([
      { id: "backlog", value: { label: "Backlog" } },
      { id: "ready", value: { label: "Ready" } },
    ]);

    await storage.delete(scope, "lastRun");
    await collection.delete("ready");

    expect(await storage.get(scope, "lastRun")).toBeNull();
    expect(await collection.get("ready")).toBeNull();
  });

  test("survives instance disable and cascades when a project is deleted", async () => {
    const instances = createExtensionInstancesDBService(db);
    const storage = createExtensionStorageDBService(db);
    const scope = { project_id: projectId, extension_id: "local.review", scope_type: "project", scope_id: "" };

    await instances.create({
      project_id: projectId,
      extension_id: "local.review",
      display_name: "Review",
      source_kind: "local",
      local_path: ".pstdio/extensions/local.review",
    });
    await storage.set(scope, "enabledState", { value: true });
    await storage.collection(scope, "runs").put("latest", { id: "latest" });

    await instances.disable(projectId, "local.review");
    expect(await storage.get(scope, "enabledState")).toEqual({ value: true });

    await createProjectsDBService(db).hardDelete(projectId);

    expect(await db.select().from(extension_kv).where(eq(extension_kv.project_id, projectId))).toHaveLength(0);
    expect(
      await db.select().from(extension_collection_items).where(eq(extension_collection_items.project_id, projectId)),
    ).toHaveLength(0);
  });
});

describe("createExtensionTemplatePreferencesDBService", () => {
  test("defaults missing preferences to enabled and stores disablement", async () => {
    const preferences = createExtensionTemplatePreferencesDBService(db);

    expect(await preferences.isEnabled(projectId, "local.templates", "defaultTicket")).toBe(true);

    await preferences.setEnabled(projectId, "local.templates", "defaultTicket", false);
    expect(await preferences.isEnabled(projectId, "local.templates", "defaultTicket")).toBe(false);

    await preferences.setEnabled(projectId, "local.templates", "defaultTicket", true);
    expect(await preferences.isEnabled(projectId, "local.templates", "defaultTicket")).toBe(true);
  });
});
