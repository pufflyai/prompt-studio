import { afterEach, expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
import { getDashboardWorkspaceDiffSummary } from "./workspace-diff-summary-data";
import { watchDashboardWorkspaceDiffSummaries } from "./workspace-diff-summary-watch";

const accountResponse = (request: Request) =>
  new URL(request.url).pathname.endsWith("/v1/account")
    ? Response.json({ login: null, features: null, cloudProjects: [], cloudProjectsLoaded: true })
    : undefined;

const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
afterEach(() => {
  delete runtime.__PSTDIO_CONFIG__;
});

test("subscribed badge totals load when the same workspace becomes ready", async () => {
  const workspaceId = "badge-readiness-workspace";
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const account = accountResponse(request);
      if (account) return account;
      requests.push(new URL(request.url).pathname);
      return Response.json({ workspace_id: workspaceId, additions: 7, deletions: 2, file_count: 1 });
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
  const writer = getWriter("workspaces")!;
  const row = {
    id: workspaceId,
    root_path: "/project",
    execution_kind: "local",
    provider_state: "ready",
    initializing: true,
    provider_capabilities_json: { diff: true },
  };
  writer.upsert(row);
  const firstCheck = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();
  let notificationCount = 0;
  const dispose = watchDashboardWorkspaceDiffSummaries([workspaceId], () => {
    notificationCount += 1;
    firstCheck.resolve();
    if (getDashboardWorkspaceDiffSummary(workspaceId)) ready.resolve();
  });
  try {
    await firstCheck.promise;
    expect(requests).toEqual([]);
    writer.upsert({ ...row, initializing: false });
    await ready.promise;
    expect(requests).toEqual([`/v1/workspaces/${workspaceId}/diff-summary`]);
    expect(getDashboardWorkspaceDiffSummary(workspaceId)).toMatchObject({ additions: 7, deletions: 2, fileCount: 1 });

    dispose();
    const notifiedAtDispose = notificationCount;
    writer.upsert({ ...row, initializing: true });
    writer.upsert({ ...row, initializing: false });
    await Promise.resolve();
    expect(notificationCount).toBe(notifiedAtDispose);
    expect(requests).toHaveLength(1);
  } finally {
    dispose();
    writer.remove(workspaceId);
    server.stop(true);
  }
});

test("a relevant workspace change refreshes loaded totals and unrelated rows perform no reads", async () => {
  const id = "fresh-diff";
  let additions = 1;
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const account = accountResponse(request);
      if (account) return account;
      if (new URL(request.url).pathname.endsWith("diff-summary")) requests++;
      return Response.json({ workspace_id: id, additions, deletions: 0, file_count: 1 });
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
  const writer = getWriter("workspaces")!;
  const row = {
    id,
    project_id: "project",
    provider_state: "ready",
    root_path: "/p",
    provider_capabilities_json: { diff: true },
  };
  writer.upsert(row);
  const loaded = Promise.withResolvers<void>();
  const fresh = Promise.withResolvers<void>();
  const stop = watchDashboardWorkspaceDiffSummaries([id], () => {
    const value = getDashboardWorkspaceDiffSummary(id);
    if (value?.additions === 1) loaded.resolve();
    if (value?.additions === 9) fresh.resolve();
  });
  try {
    await loaded.promise;
    additions = 9;
    writer.upsert({ id: "other-diff", project_id: "elsewhere", provider_state: "ready" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(requests).toBe(1);
    writer.upsert({ ...row, updated_at: "new revision" });
    await Promise.race([fresh.promise, new Promise<void>((resolve) => setTimeout(resolve, 100))]);
    expect(getDashboardWorkspaceDiffSummary(id)?.additions).toBe(9);
    expect(requests).toBe(2);
  } finally {
    stop();
    writer.remove(id);
    writer.remove("other-diff");
    server.stop(true);
  }
});
