import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createSessionsApi } from "../../extensions/command-environment/sessions";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let server: ReturnType<typeof Bun.serve>;
let client: ReturnType<typeof createClient>;
let requests = 0;
beforeAll(async () => {
  handle = await createTestApp();
  server = Bun.serve({
    port: 0,
    fetch: (request) => {
      if (new URL(request.url).pathname.endsWith("/sessions")) requests++;
      return handle.app.fetch(request);
    },
  });
  client = createClient({ baseUrl: server.url.toString() });
});
afterAll(async () => {
  server?.stop(true);
  await handle?.close();
});

test("SDK iteration reads a live session beyond page one and stops requesting after break", async () => {
  const project = await handle.deps.projectService.create({ name: "Paged sessions" });
  const live = await handle.deps.sessionService.create({ project_id: project.id, title: "Live", agent: "worker" });
  for (let index = 0; index < 54; index++)
    await handle.deps.sessionService.create({
      project_id: project.id,
      title: `Completed ${index}`,
      agent: "worker",
      status: "completed",
    });
  requests = 0;
  const items = [];
  for await (const session of client.sessions.iterate(project.id)) items.push(session);
  expect(items).toHaveLength(55);
  expect(new Set(items.map((item) => item.id)).size).toBe(55);
  expect(items[54].id).toBe(live.id);
  expect(items[54].status).toBe("in_progress");
  expect(requests).toBe(2);
  requests = 0;
  for await (const session of client.sessions.iterate(project.id)) {
    expect(session.id).toBe(items[0].id);
    break;
  }
  expect(requests).toBe(1);
});

test("HTTP, SDK and command queries share status arrays, archive, workspace and timestamp filters", async () => {
  const project = await handle.deps.projectService.create({ name: "Filtered sessions" });
  const workspace = await handle.deps.workspaceService.createStandalone({ project_id: project.id });
  const row = await handle.deps.sessionService.create({
    project_id: project.id,
    title: "Archived",
    agent: "worker",
    status: "completed",
    anchors: [{ type: "session", id: "query/#?" }],
  });
  await handle.deps.sessionService.archive(row.id);
  await handle.deps.workspaceSessionService.link(workspace.id, row.id);
  await handle.deps.sessionService.create({
    project_id: project.id,
    title: "Other",
    agent: "other",
    status: "completed",
  });
  const filter = {
    status: ["completed", "failed"] as const,
    includeArchived: true,
    agent: "worker",
    workspaceId: workspace.workspace_shorthand,
    createdFrom: row.created_at,
    createdTo: row.created_at,
    updatedFrom: row.updated_at,
    anchor: { type: "session", id: "query/#?" },
  };
  const query = { ...filter, status: [...filter.status] };
  const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "P" } });
  const expected = await api.query(query);
  expect(expected.items.map((item) => item.id)).toEqual([row.id]);
  expect(await client.sessions.query(project.id, query)).toEqual(expected);
  expect(await client.sessions.query(project.id, { ...query, includeArchived: false })).toEqual({
    items: [],
    nextCursor: null,
  });
  expect(await client.sessions.query(project.id, { status: [] })).toEqual({ items: [], nextCursor: null });
  const foreign = await handle.deps.projectService.create({ name: "Foreign" });
  expect(await client.sessions.query(foreign.id)).toEqual({ items: [], nextCursor: null });
});

test("SDK session iteration cancels before fetching and while yielding a cached page", async () => {
  const project = await handle.deps.projectService.create({ name: "Cancelled query" });
  for (const title of ["First", "Second"])
    await handle.deps.sessionService.create({ project_id: project.id, title, agent: "worker" });
  const beforeStart = new AbortController();
  beforeStart.abort();
  requests = 0;
  await expect(client.sessions.iterate(project.id, {}, { signal: beforeStart.signal }).next()).rejects.toThrow();
  expect(requests).toBe(0);
  const controller = new AbortController();
  const iterator = client.sessions.iterate(project.id, {}, { signal: controller.signal });
  expect((await iterator.next()).done).toBe(false);
  controller.abort();
  await expect(iterator.next()).rejects.toThrow();
  expect(requests).toBe(1);
});

test("SDK reads and command queries share camelCase session fields and legacy aliases", async () => {
  const project = await handle.deps.projectService.create({ name: "Session shapes" });
  const workspace = await handle.deps.workspaceService.createStandalone({ project_id: project.id });
  const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Mapped", agent: "worker" });
  await handle.deps.workspaceSessionService.link(workspace.id, session.id);
  const commands = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "P" } });
  const command = await commands.get(session.id);
  const read = await client.sessions.get(session.id);
  expect(read).toMatchObject(command!);
  expect(read).toMatchObject({
    workspaceId: workspace.id,
    workspace_id: workspace.id,
    createdAt: session.created_at,
    lastRequestStarted: session.last_request_started,
    cwd: null,
  });
  const page = await client.sessions.query(project.id);
  expect(page.items).toEqual((await commands.query()).items);
});

test("session readers omit a linked workspace owned by another project", async () => {
  const project = await handle.deps.projectService.create({ name: "Session owner" });
  const foreign = await handle.deps.projectService.create({ name: "Foreign workspace" });
  const workspace = await handle.deps.workspaceService.createStandalone({ project_id: foreign.id });
  const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Mapped", agent: "worker" });
  await handle.deps.workspaceSessionService.link(workspace.id, session.id);
  const commands = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "P" } });
  expect(await commands.get(session.id)).toMatchObject({ workspaceId: null, workspace_id: null });
  expect(await client.sessions.get(session.id)).toMatchObject({ workspaceId: null, workspace_id: null });
});
