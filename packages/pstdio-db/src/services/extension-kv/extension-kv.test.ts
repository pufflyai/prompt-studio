import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createExtensionKvDBService } from "./extension-kv";

let db: DbClient;
let close: () => Promise<void>;
let service: ReturnType<typeof createExtensionKvDBService>;
let projectId: string;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;

  const projects = createProjectsDBService(db);
  const project = await projects.create({ name: "test-project" });
  projectId = project.id;

  service = createExtensionKvDBService(db);
});

afterEach(async () => {
  await close();
});

const baseScope = {
  extension_id: "pstdio.planner",
  namespace: "planner",
  scope_type: "project",
  scope_id: "",
};

describe("extension-kv service", () => {
  test("set inserts a new value", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      key: "lastSyncCursor",
      value: "abc-123",
    });

    const value = await service.get({
      project_id: projectId,
      ...baseScope,
      key: "lastSyncCursor",
    });

    expect(value).toBe("abc-123");
  });

  test("set upserts an existing key", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      key: "counter",
      value: 1,
    });

    await service.set({
      project_id: projectId,
      ...baseScope,
      key: "counter",
      value: 2,
    });

    expect(
      await service.get({
        project_id: projectId,
        ...baseScope,
        key: "counter",
      }),
    ).toBe(2);
  });

  test("get returns null for missing key", async () => {
    const value = await service.get({
      project_id: projectId,
      ...baseScope,
      key: "missing",
    });
    expect(value).toBeNull();
  });

  test("project-scope and repo-scope are isolated", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      key: "shared",
      value: "project-value",
    });

    await service.set({
      project_id: projectId,
      extension_id: "pstdio.planner",
      namespace: "planner",
      scope_type: "repo",
      scope_id: "repo-1",
      key: "shared",
      value: "repo-value",
    });

    const projectValue = await service.get({
      project_id: projectId,
      ...baseScope,
      key: "shared",
    });
    const repoValue = await service.get({
      project_id: projectId,
      extension_id: "pstdio.planner",
      namespace: "planner",
      scope_type: "repo",
      scope_id: "repo-1",
      key: "shared",
    });

    expect(projectValue).toBe("project-value");
    expect(repoValue).toBe("repo-value");
  });

  test("listByExtension returns all keys for an extension across scopes", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      key: "a",
      value: 1,
    });
    await service.set({
      project_id: projectId,
      extension_id: "pstdio.planner",
      namespace: "planner",
      scope_type: "ticket",
      scope_id: "PS-1",
      key: "b",
      value: 2,
    });

    const all = await service.listByExtension(projectId, "pstdio.planner");
    expect(all).toHaveLength(2);
  });

  test("delete removes the row", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      key: "doomed",
      value: "x",
    });

    const removed = await service.delete({
      project_id: projectId,
      ...baseScope,
      key: "doomed",
    });
    expect(removed).toBe(true);

    expect(
      await service.get({
        project_id: projectId,
        ...baseScope,
        key: "doomed",
      }),
    ).toBeNull();
  });
});
