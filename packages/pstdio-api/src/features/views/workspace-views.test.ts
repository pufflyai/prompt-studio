import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";

const boardId = "dashboard-workbench.workspaces";
let app: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
let previousExtensions: string | undefined;
const request = (projectId: string, path: string, method = "GET", body?: unknown) =>
  app.app.request(`/v1/projects/${projectId}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const project = async (name: string) => {
  const response = await app.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name })),
  });
  expect(response.status).toBe(201);
  return (await response.json()).id as string;
};
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "workspace-views-"));
  previousExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  app = await createTestApp({ storageRoot: root });
});
afterEach(async () => {
  await app?.close();
  if (previousExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousExtensions;
  rmSync(root, { recursive: true, force: true });
});

test("native Workspaces exposes stable fields without extensions or data rows", async () => {
  const id = await project("Workspace fields");
  const response = await request(id, `/boards/${boardId}`);
  expect(response.status).toBe(200);
  const board = await response.json();
  expect(board).toMatchObject({ id: boardId, kind: "dataTable", extensionId: null });
  expect(board.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "name", kind: "string", filterable: true }),
      expect.objectContaining({ id: "type", kind: "string", groupable: true }),
      expect.objectContaining({ id: "created", kind: "date" }),
      expect.objectContaining({ id: "diff", kind: "number", filterable: false, sortable: true, displayable: true }),
    ]),
  );
  expect(await (await request(id, "/boards")).json()).toEqual(expect.arrayContaining([board]));
});

test("workspace views reject Diff filters while retaining Diff sorting", async () => {
  const id = await project("Workspace diff capabilities");
  const path = `/boards/${boardId}/views`;
  const response = await request(id, path, "POST", {
    title: "Changed workspaces",
    filter: { conjunction: "and", rules: [{ attributeId: "diff", condition: "gt", value: 10 }] },
  });
  expect(response.status).toBe(400);
  expect(
    (
      await request(id, path, "POST", {
        title: "Most changes",
        sorts: [{ attributeId: "diff", direction: "desc" }],
      })
    ).status,
  ).toBe(201);
});

test("workspace views share create edit default reorder and delete within their project", async () => {
  const id = await project("Saved workspaces");
  const other = await project("Other workspaces");
  const path = `/boards/${boardId}/views`;
  const initial = await request(id, path);
  expect(initial.status).toBe(200);
  const initialViews = await initial.json();
  const initialId = initialViews.views[0].id;
  expect(initialViews).toMatchObject({ defaultViewId: initialId, views: [{ builtIn: false }] });
  const filter = { conjunction: "and", rules: [{ attributeId: "name", condition: "contains", value: "release" }] };
  const create = await request(id, path, "POST", {
    title: "Release",
    filter,
    sorts: [{ attributeId: "created", direction: "desc" }],
    settings: { grouping: "type", rowNumbers: false, showStats: true },
  });
  expect(create.status).toBe(201);
  const view = await create.json();
  expect(view).toMatchObject({ filter, settings: { grouping: "type", rowNumbers: false, showStats: true } });
  expect((await request(other, `/board-views/${view.id}`)).status).toBe(404);
  expect((await (await request(other, path)).json()).views).toHaveLength(1);
  expect((await request(id, `/board-views/${view.id}`, "PATCH", { title: "Release workspaces" })).status).toBe(200);
  expect((await (await request(id, `/board-views/${view.id}`)).json()).title).toBe("Release workspaces");
  for (const viewId of [view.id, initialId, view.id]) {
    const response = await request(id, `${path}/default`, "PUT", { viewId });
    expect(response.status).toBe(200);
    expect((await response.json()).defaultViewId).toBe(viewId);
  }
  expect((await request(id, `${path}/order`, "PUT", { viewIds: [view.id, initialId] })).status).toBe(200);
  expect((await request(id, `/board-views/${view.id}`, "DELETE")).status).toBe(200);
  expect(await (await request(id, path)).json()).toMatchObject({ defaultViewId: initialId });
  expect((await request(id, `/board-views/${initialId}`, "PATCH", { title: "All workspaces" })).status).toBe(200);
  expect((await request(id, `/board-views/${initialId}`, "DELETE")).status).toBe(409);
  const bad = await request(id, path, "POST", { title: "Wrong kind", settings: { viewMode: "board" } });
  expect(bad.status).toBe(400);
});
