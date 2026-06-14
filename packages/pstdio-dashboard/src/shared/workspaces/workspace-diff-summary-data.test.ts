import { afterEach, describe, expect, test } from "bun:test";
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
  });

  test("resolves requested summaries for initial render updates", async () => {
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
});
