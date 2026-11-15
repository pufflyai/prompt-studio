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

test("SDK session search includes linked workspace history in one filtered page", async () => {
  const project = await handle.deps.projectService.create({ name: "Related sessions" });
  const anchor = { type: "project", id: project.id, extensionId: "pstdio", projectId: project.id };
  const workspace = await handle.deps.workspaceService.createStandalone({ project_id: project.id, anchors: [anchor] });
  const session = await handle.deps.sessionService.create({
    project_id: project.id,
    title: "Wanted 100%_ history",
    agent: "worker",
    status: "completed",
  });
  await handle.deps.workspaceSessionService.link(workspace.id, session.id);
  await handle.deps.sessionService.create({ project_id: project.id, title: "Unrelated", agent: "worker" });
  expect(
    (
      await client.sessions.query(project.id, { anchor, includeWorkspaceAnchors: true, search: "100%_", limit: 1 })
    ).items.map(({ id }) => id),
  ).toEqual([session.id]);
  expect((await client.sessions.query(project.id, { anchor, search: "100%_", limit: 1 })).items).toEqual([]);
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

test("HTTP and SDK queries preserve owner-qualified anchors and latest activity across pages", async () => {
  const project = await handle.deps.projectService.create({ name: "Qualified session query" });
  const anchor = { type: "drawing", id: "same/#?", extensionId: "example.drawings", projectId: project.id };
  const rows = [];
  for (const title of ["Older active", "Newer", "Other owner"])
    rows.push(await handle.deps.sessionService.create({ project_id: project.id, title, agent: "worker" }));
  await handle.deps.sessionService.addAnchors(rows[0].id, [anchor]);
  await handle.deps.sessionService.addAnchors(rows[1].id, [anchor]);
  await handle.deps.sessionService.addAnchors(rows[2].id, [{ ...anchor, extensionId: "other.drawings" }]);
  await handle.deps.sessionService.update(rows[0].id, { last_request_started: "2030-01-01T00:00:00.000Z" });
  const input = { anchor, orderBy: "lastActivity" as const, limit: 1 };
  const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "P" } });
  const expected = await api.query(input);
  expect(expected.items.map((row) => row.id)).toEqual([rows[0].id]);
  expect(await client.sessions.query(project.id, input)).toEqual(expected);
  const actual = [];
  for await (const row of client.sessions.iterate(project.id, input)) actual.push(row.id);
  expect(actual).toEqual([rows[0].id, rows[1].id]);
  expect(
    await client.sessions.query(project.id, { ...input, anchor: { ...anchor, projectId: "another-project" } }),
  ).toEqual({ items: [], nextCursor: null });
  const query = new URLSearchParams({
    orderBy: "lastActivity",
    anchorType: anchor.type,
    anchorId: anchor.id,
    anchorExtensionId: anchor.extensionId,
    anchorProjectId: anchor.projectId,
    limit: "1",
  });
  const response = await fetch(`${server.url}v1/projects/${project.id}/sessions?${query}`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(expected);
});

test("HTTP session queries reject incomplete anchors and unsupported sort orders", async () => {
  const project = await handle.deps.projectService.create({ name: "Invalid query filters" });
  for (const query of ["anchorExtensionId=example", "anchorProjectId=project", "anchorType=drawing", "orderBy=title"]) {
    const response = await fetch(`${server.url}v1/projects/${project.id}/sessions?${query}`);
    expect(response.status).toBe(400);
  }
});

test("SDK and extension queries page by update time using the same public order", async () => {
  const project = await handle.deps.projectService.create({ name: "Updated conversations" });
  const first = await handle.deps.sessionService.create({ project_id: project.id, title: "First", agent: "worker" });
  const second = await handle.deps.sessionService.create({ project_id: project.id, title: "Second", agent: "worker" });
  const changed = await handle.deps.sessionService.update(first.id, {
    last_request_started: "2030-01-01T00:00:00.000Z",
  });
  const renamed = await handle.deps.sessionService.update(second.id, { title: "Renamed" });
  const expected = [changed!, renamed!].sort(
    (a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id),
  );
  const input = { orderBy: "updated" as const, limit: 1 };
  const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "P" } });
  expect((await api.query(input)).items.map((row) => row.id)).toEqual([expected[0].id]);
  const actual = [];
  for await (const row of client.sessions.iterate(project.id, input)) actual.push(row.id);
  expect(actual).toEqual(expected.map((row) => row.id));
});
