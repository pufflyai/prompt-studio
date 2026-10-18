import { expect, test } from "bun:test";
import { createClient } from "./client";

test("resource queries share bounded page results and encode project scope", async () => {
  const paths: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const url = new URL(request.url);
      paths.push(url.pathname + url.search);
      return Response.json({ items: [{ id: "item" }], nextCursor: null });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    const query = { cursor: "after / one", limit: 17 };
    for (const result of [
      await client.projects.query(query),
      await client.workspaces.query("project / one", query),
      await client.skills.query("project / one", query),
      await client.views.query("project / one", "board / one", query),
    ]) {
      expect(result.items.map((item) => item.id)).toEqual(["item"]);
      expect(result.nextCursor).toBeNull();
    }
    const suffix = "?cursor=after+%2F+one&limit=17";
    expect(paths).toEqual([
      `/v1/projects/query${suffix}`,
      `/v1/projects/project%20%2F%20one/workspaces${suffix}`,
      `/v1/projects/project%20%2F%20one/skills/query${suffix}`,
      `/v1/projects/project%20%2F%20one/boards/board%20%2F%20one/views/query${suffix}`,
    ]);
  } finally {
    server.stop(true);
  }
});

test("create methods take project scope first and retain legacy calls", async () => {
  const calls: { path: string; body: unknown }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      calls.push({ path: new URL(request.url).pathname, body: await request.json() });
      return Response.json({ id: "created" });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    await client.workspaces.create("project", { providerId: "pstdio.worktree", params: { base: "main" } });
    await client.workspaces.create({ project_id: "project", provider_id: "pstdio.worktree", params: { base: "main" } });
    await client.notifications.create("project", { title: "Notice", body: "Ready", kind: "info" });
    await client.notifications.create({ projectId: "project", title: "Notice", body: "Ready", kind: "info" });
    await client.sessions.create("project", { title: "Work", workspaceId: "workspace" });
    await client.sessions.create({ project_id: "project", title: "Work", workspace_id: "workspace" });
    expect(calls.map((call) => call.body)).toEqual([
      { projectId: "project", providerId: "pstdio.worktree", params: { base: "main" } },
      { project_id: "project", provider_id: "pstdio.worktree", params: { base: "main" } },
      { title: "Notice", body: "Ready", kind: "info" },
      { title: "Notice", body: "Ready", kind: "info" },
      { projectId: "project", title: "Work", workspaceId: "workspace" },
      { project_id: "project", title: "Work", workspace_id: "workspace" },
    ]);
    expect(calls.slice(2, 4).map((call) => call.path)).toEqual([
      "/v1/projects/project/notifications",
      "/v1/projects/project/notifications",
    ]);
  } finally {
    server.stop(true);
  }
});

test("dynamic catalogs expose pages and use projectId as the query parameter", async () => {
  const paths: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const url = new URL(request.url);
      paths.push(url.pathname + url.search);
      return Response.json({ items: [], nextCursor: null });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    await client.agents.query("project", { limit: 2 });
    await client.agents.queryModels("project", "agent", { limit: 2 });
    await client.workspaces.queryProviders("project", { limit: 2 });
    await client.views.queryBoards("project", { limit: 2 });
    await client.views.queryOrphaned("project", { limit: 2 });
    expect(paths).toEqual([
      "/v1/agents/query?projectId=project&limit=2",
      "/v1/agents/agent/models/query?projectId=project&limit=2",
      "/v1/projects/project/workspace-providers/query?limit=2",
      "/v1/projects/project/boards/query?limit=2",
      "/v1/projects/project/board-views/query?orphaned=true&limit=2",
    ]);
  } finally {
    server.stop(true);
  }
});

test("canonical notification and link reads normalize terminal cursors to null", async () => {
  const paths: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      paths.push(new URL(request.url).pathname);
      return Response.json({ items: [] });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    expect((await client.notifications.query("project")).nextCursor).toBeNull();
    expect(
      (await client.resources.queryAnchors("project", { resource: { type: "workspace", id: "workspace" } })).nextCursor,
    ).toBeNull();
    expect(paths).toEqual(["/v1/projects/project/notifications", "/v1/projects/project/resource-anchors/query-page"]);
  } finally {
    server.stop(true);
  }
});

test("activity filters retain canonical and deprecated event names", async () => {
  const queries: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      queries.push(new URL(request.url).search);
      return Response.json({ events: [], items: [], next_cursor: null, nextCursor: null });
    },
  });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    await client.sessions.listActivity("session", { eventType: "changed" });
    await client.workspaces.listActivity("workspace", { eventType: "changed" });
    await client.sessions.listActivity("session", { event_type: "changed" });
    await client.workspaces.listActivity("workspace", { event_type: "changed" });
    expect(queries).toEqual(["?eventType=changed", "?eventType=changed", "?event_type=changed", "?event_type=changed"]);
  } finally {
    server.stop(true);
  }
});
