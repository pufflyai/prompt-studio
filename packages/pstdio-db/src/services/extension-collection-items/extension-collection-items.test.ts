import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createExtensionCollectionItemsDBService } from "./extension-collection-items";

let db: DbClient;
let close: () => Promise<void>;
let service: ReturnType<typeof createExtensionCollectionItemsDBService>;
let projectId: string;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;

  const projects = createProjectsDBService(db);
  const project = await projects.create({ name: "test-project" });
  projectId = project.id;

  service = createExtensionCollectionItemsDBService(db);
});

afterEach(async () => {
  await close();
});

const baseScope = {
  extension_id: "pstdio.planner",
  namespace: "planner",
  scope_type: "project",
  scope_id: "",
  collection: "ticket-index",
};

describe("extension-collection-items service", () => {
  test("set inserts an item", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-1",
      value: { title: "First ticket" },
    });

    const item = await service.get({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-1",
    });

    expect(item).toEqual({ title: "First ticket" });
  });

  test("set upserts existing item", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-1",
      value: { title: "Old" },
    });

    await service.set({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-1",
      value: { title: "New" },
    });

    const item = await service.get({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-1",
    });
    expect(item).toEqual({ title: "New" });
  });

  test("listCollection returns items in id order", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-2",
      value: { n: 2 },
    });
    await service.set({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-1",
      value: { n: 1 },
    });

    const items = await service.listCollection({
      project_id: projectId,
      extension_id: "pstdio.planner",
      collection: "ticket-index",
    });
    expect(items.map((i) => i.item_id)).toEqual(["PS-1", "PS-2"]);
  });

  test("scope isolation: same item_id in different scopes coexist", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      item_id: "shared",
      value: "project",
    });

    await service.set({
      project_id: projectId,
      extension_id: "pstdio.planner",
      namespace: "planner",
      scope_type: "repo",
      scope_id: "repo-1",
      collection: "ticket-index",
      item_id: "shared",
      value: "repo",
    });

    expect(
      await service.get({
        project_id: projectId,
        ...baseScope,
        item_id: "shared",
      }),
    ).toBe("project");
  });

  test("delete removes the item", async () => {
    await service.set({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-1",
      value: { n: 1 },
    });

    const removed = await service.delete({
      project_id: projectId,
      ...baseScope,
      item_id: "PS-1",
    });
    expect(removed).toBe(true);

    expect(
      await service.get({
        project_id: projectId,
        ...baseScope,
        item_id: "PS-1",
      }),
    ).toBeNull();
  });
});
