import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../projects/projects";
import { createProjectExtensionInstancesDBService } from "./project-extension-instances";

let db: DbClient;
let close: () => Promise<void>;
let service: ReturnType<typeof createProjectExtensionInstancesDBService>;
let projectId: string;
let installedId: string;

const installedInput = {
  install_name: "planner",
  extension_id: "pstdio.planner",
  namespace: "planner",
  display_name: "Planner",
  source_path: "/Users/test/.pstdio/extensions/planner",
  source_kind: "catalog",
};

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;

  const projects = createProjectsDBService(db);
  const installed = createInstalledExtensionSourcesDBService(db);

  const project = await projects.create({ name: "test-project" });
  projectId = project.id;

  const source = await installed.create(installedInput);
  installedId = source.id;

  service = createProjectExtensionInstancesDBService(db);
});

afterEach(async () => {
  await close();
});

const baseInput = () => ({
  project_id: projectId,
  installed_extension_id: installedId,
  extension_id: "pstdio.planner",
  namespace: "planner",
  display_name: "Planner",
});

describe("project-extension-instances service", () => {
  test("create stores enabled instance with empty config", async () => {
    const created = await service.create(baseInput());

    expect(created.enabled).toBe(true);
    expect(created.config_json).toEqual({});
    expect(created.diagnostics_json).toBeNull();
  });

  test("listByProject returns instances for a project", async () => {
    await service.create(baseInput());

    const all = await service.listByProject(projectId);
    expect(all).toHaveLength(1);
    expect(all[0].extension_id).toBe("pstdio.planner");
  });

  test("getByExtensionId returns matching instance", async () => {
    await service.create(baseInput());

    const fetched = await service.getByExtensionId(projectId, "pstdio.planner");
    expect(fetched?.namespace).toBe("planner");

    const missing = await service.getByExtensionId(projectId, "pstdio.unknown");
    expect(missing).toBeNull();
  });

  test("setEnabled toggles the enabled flag", async () => {
    const created = await service.create(baseInput());

    const disabled = await service.setEnabled(created.id, false);
    expect(disabled?.enabled).toBe(false);

    const reenabled = await service.setEnabled(created.id, true);
    expect(reenabled?.enabled).toBe(true);
  });

  test("setConfig replaces config_json", async () => {
    const created = await service.create(baseInput());

    const updated = await service.setConfig(created.id, { repoFilter: "frontend" });
    expect(updated?.config_json).toEqual({ repoFilter: "frontend" });
  });

  test("project_id+extension_id is unique per project", async () => {
    await service.create(baseInput());
    await expect(service.create(baseInput())).rejects.toThrow();
  });

  test("project_id+namespace is unique per project", async () => {
    await service.create(baseInput());

    await expect(
      service.create({
        ...baseInput(),
        extension_id: "pstdio.other",
      }),
    ).rejects.toThrow();
  });

  test("remove deletes the instance row but preserves installed source", async () => {
    const created = await service.create(baseInput());

    const removed = await service.remove(created.id);
    expect(removed).toBe(true);

    const installed = createInstalledExtensionSourcesDBService(db);
    expect(await installed.get(installedId)).not.toBeNull();
  });
});
