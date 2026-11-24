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
  try {
    await close?.();
  } finally {
    // Hooks recreate these owners; release closed engines between cases and files.
    close = undefined!;
    svc = undefined!;
    sourcesSvc = undefined!;
    db = undefined!;
  }
});

describe("extensionInstancesService", () => {
  test("adopts an extracted default after discovery and preserves later disable and uninstall choices", async () => {
    const discovered = await svc.create({
      installed_extension_id: installedId,
      scope_type: "project",
      scope_id: projectId,
      enabled: false,
    });
    const input = { projectId, extensionId: "pstdio.core-templates", installedSourceId: installedId };
    expect((await svc.adoptProjectDefault(input))?.enabled).toBe(true);
    await svc.update(discovered.id, { enabled: false });
    expect(await svc.adoptProjectDefault(input)).toBeNull();
    expect((await svc.get(discovered.id))?.enabled).toBe(false);
    await svc.remove(discovered.id);
    expect(await svc.adoptProjectDefault(input)).toBeNull();
    expect(await svc.list({ scope_id: projectId })).toEqual([]);
  });

  test("an explicit choice before default adoption preserves the disabled provider", async () => {
    const discovered = await svc.create({
      installed_extension_id: installedId,
      scope_type: "project",
      scope_id: projectId,
      enabled: false,
    });
    await svc.recordProjectDefaultChoice(projectId, "pstdio.core-templates");
    expect(
      await svc.adoptProjectDefault({
        projectId,
        extensionId: "pstdio.core-templates",
        installedSourceId: installedId,
      }),
    ).toBeNull();
    expect((await svc.get(discovered.id))?.enabled).toBe(false);
  });

  test("creates and retrieves a project extension configuration", async () => {
    const created = await svc.create({
      installed_extension_id: installedId,
      scope_type: "project",
      scope_id: projectId,
    });

    const fetched = await svc.findByScopeInstalledSource("project", projectId, installedId);
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
      scope_type: "project",
      scope_id: projectId,
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

test("activating a published source keeps the project instance and leaves other projects on their local source", async () => {
  const first = await svc.create({
    installed_extension_id: installedId,
    scope_type: "project",
    scope_id: projectId,
    config_json: { keep: true },
  });
  const otherProject = "other-workbench";
  await db.insert(projects).values({
    id: otherProject,
    name: "Other",
    shorthand: "O",
    created_at: nowTimestamp(),
    updated_at: nowTimestamp(),
  });
  const other = await svc.create({
    installed_extension_id: installedId,
    scope_type: "project",
    scope_id: "other-workbench",
  });
  const source = await sourcesSvc.register({
    install_name: "published",
    extension_id: "pstdio.core-templates",
    display_name: "Published",
    source_kind: "registry",
    source_path: "/published/revision",
  });
  const [activated] = await svc.activateProjectSources([
    {
      projectId,
      extensionId: source.extension_id,
      instanceId: first.id,
      installedSourceId: source.id,
      enabled: false,
    },
  ]);
  expect(activated!.instance.id).not.toBe(first.id);
  expect(activated!.removed.map((row) => row.id)).toEqual([first.id]);
  expect(activated!.instance.config_json).toEqual({ keep: true });
  expect(activated!.instance.installed_extension_id).toBe(source.id);
  expect(activated!.instance.enabled).toBe(false);
  expect((await svc.get(other.id))?.installed_extension_id).toBe(installedId);
});

test("a new local provider aborts the complete published set transaction", async () => {
  const first = await svc.create({ installed_extension_id: installedId, scope_type: "project", scope_id: projectId });
  const next = await sourcesSvc.register({
    install_name: "next",
    extension_id: "pstdio.core-templates",
    display_name: "Next",
    source_kind: "registry",
    source_path: "/published/next",
  });
  const local = await sourcesSvc.register({
    install_name: "private",
    extension_id: "test.other",
    display_name: "Private",
    source_kind: "local_path",
    source_path: "/private/other",
  });
  const override = await svc.create({ installed_extension_id: local.id, scope_type: "project", scope_id: projectId });
  const remote = await sourcesSvc.register({
    install_name: "remote",
    extension_id: "test.other",
    display_name: "Remote",
    source_kind: "registry",
    source_path: "/published/other",
  });
  await expect(
    svc.activateProjectSources([
      { projectId, extensionId: "pstdio.core-templates", instanceId: first.id, installedSourceId: next.id },
      { projectId, extensionId: "test.other", installedSourceId: remote.id },
    ]),
  ).rejects.toThrow("changed during activation");
  expect((await svc.get(first.id))?.installed_extension_id).toBe(installedId);
  expect((await svc.get(override.id))?.enabled).toBe(true);
});
