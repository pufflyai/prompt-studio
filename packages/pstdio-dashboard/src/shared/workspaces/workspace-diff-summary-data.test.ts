import { afterEach, describe, expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
import {
  getDashboardWorkspaceDiffSummary,
  requestDashboardWorkspaceDiffSummaries,
} from "./workspace-diff-summary-data";

const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
  };
};

const originalFetch = globalThis.fetch;

const toUrl = (input: URL | RequestInfo) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

describe("workspace diff summary data", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
    globalThis.fetch = originalFetch;
    getWriter("workspaces")!.remove("workspace-first-load");
  });

  test("resolves requested summaries for initial render updates", async () => {
    getWriter("workspaces")!.upsert({ id: "workspace-first-load", provider_capabilities_json: { diff: true } });
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: "http://localhost:19840" };

    const calls: string[] = [];
    const fetchMock = Object.assign(
      async (input: URL | RequestInfo) => {
        calls.push(toUrl(input));
        await Promise.resolve();

        return new Response(
          JSON.stringify({
            workspace_id: "workspace-first-load",
            additions: 12,
            deletions: 3,
            file_count: 2,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
      { preconnect: originalFetch.preconnect?.bind(originalFetch) },
    ) as typeof fetch;
    globalThis.fetch = fetchMock;

    const summaries = await requestDashboardWorkspaceDiffSummaries(["workspace-first-load"]);

    expect(calls).toEqual(["http://localhost:19840/v1/workspaces/workspace-first-load/diff-summary?mode=fork_point"]);
    expect(summaries.get("workspace-first-load")).toMatchObject({ additions: 12, deletions: 3, fileCount: 2 });
    expect(getDashboardWorkspaceDiffSummary("workspace-first-load")).toMatchObject({
      additions: 12,
      deletions: 3,
      fileCount: 2,
    });
  });

  test("requests summaries only while a workspace declares diff support", async () => {
    const workspaceId = "workspace-diff-capability";
    const requests: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch: (request) => {
        requests.push(new URL(request.url).pathname);
        return Response.json({ workspace_id: workspaceId, additions: 1, deletions: 0, file_count: 1 });
      },
    });
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: server.url.toString() };
    const writer = getWriter("workspaces")!;

    try {
      for (const diff of [false, undefined]) {
        writer.upsert({ id: workspaceId, provider_capabilities_json: { files: "write", diff } });
        expect(await requestDashboardWorkspaceDiffSummaries([workspaceId])).toEqual(new Map());
        expect(requests).toEqual([]);
      }
      writer.upsert({ id: workspaceId, provider_capabilities_json: { files: "write", diff: true } });
      expect((await requestDashboardWorkspaceDiffSummaries([workspaceId])).get(workspaceId)).toMatchObject({
        additions: 1,
        deletions: 0,
        fileCount: 1,
      });
      expect(requests).toEqual([`/v1/workspaces/${workspaceId}/diff-summary`]);

      writer.upsert({ id: workspaceId, provider_capabilities_json: { files: "write", diff: false } });
      expect(await requestDashboardWorkspaceDiffSummaries([workspaceId])).toEqual(new Map());
      expect(requests).toHaveLength(1);
    } finally {
      writer.remove(workspaceId);
      server.stop(true);
    }
  });
});
