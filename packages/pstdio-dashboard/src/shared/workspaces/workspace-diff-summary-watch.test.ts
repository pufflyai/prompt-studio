import { afterEach, expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
import { getDashboardWorkspaceDiffSummary } from "./workspace-diff-summary-data";
import { watchDashboardWorkspaceDiffSummaries } from "./workspace-diff-summary-watch";

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
      requests.push(new URL(request.url).pathname);
      return Response.json({ workspace_id: workspaceId, additions: 7, deletions: 2, file_count: 1 });
    },
  });
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
  const writer = getWriter("workspaces")!;
  const row = {
    id: workspaceId,
    root_path: "/project",
    worktree_path: "/project",
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
