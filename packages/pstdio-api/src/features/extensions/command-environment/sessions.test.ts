import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createSessionsApi } from "./sessions";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "session-query-"));
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
});
afterAll(async () => {
  await handle.close();
  rmSync(root, { recursive: true, force: true });
});

test("session readers expose harness and usage through an explicit public mapping", async () => {
  const project = await handle.deps.projectService.create({ name: "session readers" });
  const workspace = await handle.deps.workspaceService.createStandalone({ project_id: project.id });
  const row = await handle.deps.sessionService.create({
    project_id: project.id,
    title: "mapped",
    agent: "claude-code",
  });
  await handle.deps.workspaceSessionService.link(workspace.id, row.id);
  await handle.deps.sessionService.update(row.id, {
    usage_json: { input_tokens: 10, output_tokens: 5, cache_read_tokens: 0, cache_write_tokens: 2 },
  });
  const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "P" } });
  const page = await api.query({ workspaceId: workspace.workspace_shorthand });
  expect(page.items).toHaveLength(1);
  expect(page.items[0]).toMatchObject({
    id: row.id,
    agent: "claude-code",
    workspace_id: workspace.id,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_tokens: 0, cache_write_tokens: 2 },
  });
  expect(await api.get(row.id)).toEqual(page.items[0]);
  expect(await api.list()).toMatchObject([{ id: row.id, agent: "claude-code" }]);
  expect(await api.listByWorkspace(workspace.id)).toEqual(page.items);
  expect(page.items[0]).not.toHaveProperty("project_id");
  expect(page.items[0]).not.toHaveProperty("session_file_id");
  const foreign = await handle.deps.projectService.create({ name: "foreign" });
  const foreignWorkspace = await handle.deps.workspaceService.createStandalone({ project_id: foreign.id });
  await expect(api.query({ workspaceId: foreignWorkspace.id })).rejects.toThrow("Workspace not found");
  const controller = new AbortController();
  controller.abort();
  await expect(
    createSessionsApi(handle.deps, {
      projectId: project.id,
      project: { ...project, shorthand: "P" },
      signal: controller.signal,
    }).query(),
  ).rejects.toThrow();
});
