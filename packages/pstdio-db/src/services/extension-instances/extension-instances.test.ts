import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createExtensionInstancesDBService } from "./extension-instances";

let close: (() => Promise<void>) | undefined;
let svc: ReturnType<typeof createExtensionInstancesDBService>;
let sourcesSvc: ReturnType<typeof createInstalledExtensionSourcesDBService>;
let installedId: string;
let projectId: string;
let db: Awaited<ReturnType<typeof createDb>>["db"];

const nowTimestamp = () => new Date().toISOString();

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
  svc = createExtensionInstancesDBService(result.db);
  sourcesSvc = createInstalledExtensionSourcesDBService(result.db);

  const timestamp = nowTimestamp();
  projectId = crypto.randomUUID();
  await db
    .insert(projects)
    .values({ id: projectId, name: "Test", shorthand: "T", created_at: timestamp, updated_at: timestamp });

  const registered = await sourcesSvc.register({
    install_name: "pstdio.core-templates",
    extension_id: "pstdio.core-templates",
    display_name: "Core Templates",
    source_kind: "local_path",
    source_path: "/builtin/pstdio.core-templates",
  });
  installedId = registered.id;
});

afterEach(async () => {
  await close?.();
});

describe("extensionInstancesService", () => {
  test("creates and retrieves an instance with generic scope", async () => {
    const created = await svc.create({
      installed_extension_id: installedId,
      scope_type: "user",
      scope_id: "user-1",
    });

    const fetched = await svc.findByScopeInstalledSource("user", "user-1", installedId);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.enabled).toBe(true);
  });

  test("two projects have isolated instances", async () => {
    const project2Id = crypto.randomUUID();
    const timestamp = nowTimestamp();
    await db
      .insert(projects)
      .values({ id: project2Id, name: "Test 2", shorthand: "T2", created_at: timestamp, updated_at: timestamp });

    await svc.create({
      installed_extension_id: installedId,
      scope_type: "project",
      scope_id: projectId,
    });

    await svc.create({
      installed_extension_id: installedId,
      scope_type: "project",
      scope_id: project2Id,
    });

    const projectInstances = await svc.list({ scope_type: "project", scope_id: projectId });
    expect(projectInstances).toHaveLength(1);
  });

  test("allows multiple instances for the same scope when installed sources differ", async () => {
    const secondSource = await sourcesSvc.register({
      install_name: "pstdio.core-templates-local",
      extension_id: "pstdio.core-templates",
      display_name: "Core Templates Local",
      source_kind: "local_path",
      source_path: "/repo/.pstdio/extensions/pstdio.core-templates",
    });

    const first = await svc.create({
      installed_extension_id: installedId,
      scope_type: "project",
      scope_id: projectId,
    });
    const second = await svc.create({
      installed_extension_id: secondSource.id,
      scope_type: "project",
      scope_id: projectId,
    });

    const bySource = await svc.findByScopeInstalledSource("project", projectId, secondSource.id);

    expect(second.id).not.toBe(first.id);
    expect(bySource?.id).toBe(second.id);
  });

  test("update toggles enabled and config", async () => {
    const created = await svc.create({
      installed_extension_id: installedId,
      scope_type: "user",
      scope_id: "user-1",
    });

    const updated = await svc.update(created.id, { enabled: false, config_json: { key: "value" } });
    expect(updated?.enabled).toBe(false);
    expect(updated?.config_json).toEqual({ key: "value" });
  });

  test("remove returns the deleted row with its project scope", async () => {
    const created = await svc.create({
      installed_extension_id: installedId,
      scope_type: "project",
      scope_id: projectId,
    });

    const removed = await svc.remove(created.id);

    expect(removed).toMatchObject({
      id: created.id,
      installed_extension_id: installedId,
      scope_type: "project",
      scope_id: projectId,
    });
  });
});
