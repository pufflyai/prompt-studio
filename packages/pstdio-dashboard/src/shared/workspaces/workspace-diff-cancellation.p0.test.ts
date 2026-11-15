import { expect, test } from "bun:test";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { getDashboardWorkspaceDiffQuery, resolveDashboardWorkspaceDiffSummary } from "./workspace-diff-summary-data";

test("a held watch cannot admit the old project's summary after the workspace changes project", async () => {
  const entered = Promise.withResolvers<void>();
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      if (path === "/v1/session-stream")
        return new Response(
          new ReadableStream({
            start() {
              entered.resolve();
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (path.endsWith("/diff-summary")) reads++;
      return Response.json({ workspace_id: "moving", additions: 1, deletions: 0, file_count: 1 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const writer = owner.getWriter("workspaces")!;
  const row = {
    id: "moving",
    project_id: "first",
    execution_kind: "local",
    provider_state: "ready",
    root_path: "/moving",
    provider_capabilities_json: { diff: true },
  };
  writer.upsert(row);
  const query = getDashboardWorkspaceDiffQuery(row.id, owner, "first");
  const stop = query.subscribe(() => {});
  try {
    await entered.promise;
    writer.upsert({ ...row, project_id: "second" });
    await query.refreshObserved();
    expect(query.getSnapshot().data).toBeNull();
    expect(reads).toBe(0);
  } finally {
    stop();
    await owner.dispose();
    await server.stop(true);
  }
});

test("a queued summary cannot enter after its workspace loses diff support", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const reads: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      const workspaceId = path.split("/")[3]!;
      reads.push(workspaceId);
      if (reads.length === 3) entered.resolve();
      await release.promise;
      return Response.json({ workspace_id: workspaceId, additions: 1, deletions: 0, file_count: 1 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const writer = owner.getWriter("workspaces")!;
  const row = {
    project_id: "project",
    execution_kind: "remote",
    provider_state: "ready",
    provider_capabilities_json: { diff: true },
  };
  for (let index = 0; index < 5; index++) writer.upsert({ ...row, id: `queued-${index}` });
  const peers = Array.from({ length: 4 }, (_, index) =>
    getDashboardWorkspaceDiffQuery(`queued-${index}`, owner).read(),
  );
  let stop = () => {};
  try {
    await entered.promise;
    const query = getDashboardWorkspaceDiffQuery("queued-4", owner);
    stop = query.subscribe(() => {});
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(query.active()).toBe(true);
    writer.upsert({ ...row, id: "queued-4", provider_capabilities_json: { diff: false } });
    release.resolve();
    await Promise.all([...peers, query.refreshObserved()]);
    expect([...reads].sort()).toEqual(["queued-0", "queued-1", "queued-2", "queued-3"]);
  } finally {
    release.resolve();
    stop();
    await Promise.allSettled(peers);
    await owner.dispose();
    await server.stop(true);
  }
});

test("a cancelled optional diff cannot start a summary after held watch admission closes", async () => {
  const entered = Promise.withResolvers<void>();
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      if (path === "/v1/session-stream") {
        return new Response(
          new ReadableStream({
            start() {
              entered.resolve();
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      }
      if (path.endsWith("/diff-summary")) {
        requests.push(path);
        return Response.json({ workspace_id: "held", additions: 1, deletions: 0, file_count: 1 });
      }
      return Response.json({});
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  owner.getWriter("workspaces")!.upsert({
    id: "held",
    project_id: "project",
    execution_kind: "local",
    provider_state: "ready",
    root_path: "/held",
    provider_capabilities_json: { diff: true },
  });
  const controller = new AbortController();
  const query = getDashboardWorkspaceDiffQuery("held", owner);
  const pending = resolveDashboardWorkspaceDiffSummary("held", controller.signal, owner);
  try {
    await entered.promise;
    expect(query.getSnapshot().fetching).toBe(true);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    while (query.active()) await new Promise<void>((resolve) => setImmediate(resolve));
    expect(requests).toEqual([]);
  } finally {
    controller.abort();
    await pending.catch(() => {});
    await owner.dispose();
    await server.stop(true);
  }
});

test("cancelling optional decoration preserves an entered required diff read", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      requests++;
      entered.resolve();
      await release.promise;
      return Response.json({ workspace_id: "required", additions: 7, deletions: 2, file_count: 1 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  owner.getWriter("workspaces")!.upsert({
    id: "required",
    project_id: "project",
    execution_kind: "remote",
    provider_state: "ready",
    provider_capabilities_json: { diff: true },
  });
  const query = getDashboardWorkspaceDiffQuery("required", owner);
  const required = query.read();
  const controller = new AbortController();
  let optional: Promise<unknown> | undefined;
  try {
    await entered.promise;
    optional = resolveDashboardWorkspaceDiffSummary("required", controller.signal, owner);
    controller.abort();
    await expect(optional).rejects.toMatchObject({ name: "AbortError" });
    expect(query.getSnapshot().fetching).toBe(true);
    release.resolve();
    expect(await required).toMatchObject({ additions: 7, deletions: 2 });
    expect(requests).toBe(1);
  } finally {
    release.resolve();
    controller.abort();
    await optional?.catch(() => {});
    await required.catch(() => {});
    await owner.dispose();
    await server.stop(true);
  }
});

test("a surviving automatic diff observer keeps its held watch and accepts the summary", async () => {
  const posted = Promise.withResolvers<string>();
  const accepted = Promise.withResolvers<void>();
  const encoder = new TextEncoder();
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account")
        return Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true });
      if (path === "/v1/session-stream")
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              stream = controller;
              controller.enqueue(encoder.encode('event: connected\ndata: {"connection_id":"held"}\n\n'));
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (path.endsWith("/subscriptions") && request.method === "POST") {
        const body = (await request.json()) as { subscription_id: string };
        posted.resolve(body.subscription_id);
        return Response.json({});
      }
      if (path.endsWith("/diff-summary")) {
        requests++;
        return Response.json({ workspace_id: "peer", additions: 9, deletions: 0, file_count: 1 });
      }
      return Response.json({});
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  owner.getWriter("workspaces")!.upsert({
    id: "peer",
    project_id: "project",
    execution_kind: "local",
    provider_state: "ready",
    root_path: "/peer",
    provider_capabilities_json: { diff: true },
  });
  const query = getDashboardWorkspaceDiffQuery("peer", owner);
  const stop = query.subscribe(() => {
    if (query.getSnapshot().data?.additions === 9) accepted.resolve();
  });
  const controller = new AbortController();
  const optional = resolveDashboardWorkspaceDiffSummary("peer", controller.signal, owner);
  try {
    const id = await posted.promise;
    controller.abort();
    await expect(optional).rejects.toMatchObject({ name: "AbortError" });
    expect(query.inspect().automaticObservers).toBe(1);
    expect(requests).toBe(0);
    stream!.enqueue(
      encoder.encode(`event: diff_ready\ndata: ${JSON.stringify({ subscription_id: id, data: {} })}\n\n`),
    );
    await accepted.promise;
    expect(query.getSnapshot().data?.additions).toBe(9);
    expect(requests).toBe(1);
  } finally {
    controller.abort();
    stop();
    await optional.catch(() => {});
    await owner.dispose();
    await server.stop(true);
  }
});
